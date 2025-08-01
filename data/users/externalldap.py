import logging
import os
from collections import namedtuple

import ldap
from ldap.controls import SimplePagedResultsControl
from ldap.filter import escape_filter_chars, filter_format

from data.model import InvalidRobotException
from data.model.user import (
    find_user_by_email,
    get_nonrobot_user,
    get_username,
    lookup_robot,
)
from data.users.federated import FederatedUsers, UserInformation
from util.itertoolrecipes import take

logger = logging.getLogger(__name__)

_DEFAULT_NETWORK_TIMEOUT = 10.0  # seconds
_DEFAULT_TIMEOUT = 10.0  # seconds
_DEFAULT_PAGE_SIZE = 1000
# setting config LDAP_FOLLOW_REFERRALS: 0 to disable referral lookups
_DEFAULT_REFERRALS = True
_DEFAULT_KEEPALIVE_IDLE = 10
_DEFAULT_KEEPALIVE_INTERVAL = 5
_DEFAULT_KEEPALIVE_PROBES = 3


class LDAPConnectionBuilder(object):
    def __init__(
        self,
        ldap_uri,
        user_dn,
        user_pw,
        allow_tls_fallback=False,
        timeout=None,
        network_timeout=None,
        referrals=_DEFAULT_REFERRALS,
    ):
        self._ldap_uri = ldap_uri
        self._user_dn = user_dn
        self._user_pw = user_pw
        self._allow_tls_fallback = allow_tls_fallback
        self._timeout = timeout
        self._network_timeout = network_timeout
        self._referrals = int(referrals)

    def get_connection(self):
        return LDAPConnection(
            self._ldap_uri,
            self._user_dn,
            self._user_pw,
            self._allow_tls_fallback,
            self._timeout,
            self._network_timeout,
            self._referrals,
        )


class LDAPConnection(object):
    def __init__(
        self,
        ldap_uri,
        user_dn,
        user_pw,
        allow_tls_fallback=False,
        timeout=None,
        network_timeout=None,
        referrals=_DEFAULT_REFERRALS,
    ):
        self._ldap_uri = ldap_uri
        self._user_dn = user_dn
        self._user_pw = user_pw
        self._allow_tls_fallback = allow_tls_fallback
        self._timeout = timeout
        self._network_timeout = network_timeout
        self._referrals = int(referrals)
        self._conn = None

    def __enter__(self):
        trace_level = 2 if os.environ.get("USERS_DEBUG") == "1" else 0

        self._conn = ldap.initialize(self._ldap_uri, trace_level=trace_level)
        self._conn.set_option(ldap.OPT_REFERRALS, self._referrals)
        self._conn.set_option(
            ldap.OPT_NETWORK_TIMEOUT, self._network_timeout or _DEFAULT_NETWORK_TIMEOUT
        )
        self._conn.set_option(ldap.OPT_TIMEOUT, self._timeout or _DEFAULT_TIMEOUT)
        self._conn.set_option(ldap.OPT_X_KEEPALIVE_IDLE, _DEFAULT_KEEPALIVE_IDLE)
        self._conn.set_option(ldap.OPT_X_KEEPALIVE_INTERVAL, _DEFAULT_KEEPALIVE_INTERVAL)
        self._conn.set_option(ldap.OPT_X_KEEPALIVE_PROBES, _DEFAULT_KEEPALIVE_PROBES)
        self._conn.set_option(ldap.OPT_RESTART, ldap.OPT_ON)

        if self._allow_tls_fallback:
            logger.debug("TLS Fallback enabled in LDAP")
            self._conn.set_option(ldap.OPT_X_TLS_TRY, 1)

        # Must come _after_ all other TLS options
        self._conn.set_option(ldap.OPT_X_TLS_NEWCTX, ldap.OPT_OFF)

        self._conn.simple_bind_s(self._user_dn, self._user_pw)
        return self._conn

    def __exit__(self, exc_type, value, tb):
        self._conn.unbind_s()


class LDAPUsers(FederatedUsers):
    _LDAPResult = namedtuple("_LDAPResult", ["dn", "attrs"])

    def __init__(
        self,
        ldap_uri,
        base_dn,
        admin_dn,
        admin_passwd,
        user_rdn,
        uid_attr,
        email_attr,
        memberof_attr="memberOf",
        allow_tls_fallback=False,
        secondary_user_rdns=None,
        requires_email=True,
        timeout=None,
        network_timeout=None,
        force_no_pagination=False,
        ldap_user_filter=None,
        ldap_superuser_filter=None,
        ldap_global_readonly_superuser_filter=None,
        ldap_restricted_user_filter=None,
        ldap_referrals=_DEFAULT_REFERRALS,
    ):
        super(LDAPUsers, self).__init__("ldap", requires_email)

        self._ldap = LDAPConnectionBuilder(
            ldap_uri,
            admin_dn,
            admin_passwd,
            allow_tls_fallback,
            timeout,
            network_timeout,
            referrals=ldap_referrals,
        )
        self._ldap_uri = ldap_uri
        self._uid_attr = uid_attr
        self._email_attr = email_attr
        self._memberof_attr = memberof_attr
        self._allow_tls_fallback = allow_tls_fallback
        self._requires_email = requires_email
        self._force_no_pagination = force_no_pagination
        self._ldap_user_filter = ldap_user_filter
        self._ldap_superuser_filter = ldap_superuser_filter
        self._ldap_global_readonly_superuser_filter = ldap_global_readonly_superuser_filter
        self._ldap_restricted_user_filter = ldap_restricted_user_filter
        self._ldap_referrals = int(ldap_referrals)

        # Note: user_rdn is a list of RDN pieces (for historical reasons), and secondary_user_rds
        # is a list of RDN strings.
        relative_user_dns = [",".join(user_rdn)] + (secondary_user_rdns or [])

        def get_full_rdn(relative_dn):
            prefix = relative_dn.split(",") if relative_dn else []
            return ",".join(prefix + base_dn)

        # Create the set of full DN paths.
        self._user_dns = [get_full_rdn(relative_dn) for relative_dn in relative_user_dns]
        self._base_dn = ",".join(base_dn)

    def _get_ldap_referral_dn(self, referral_exception):
        logger.debug("Got referral: %s", referral_exception.args[0])
        if not referral_exception.args[0] or not referral_exception.args[0].get("info"):
            logger.debug("LDAP referral missing info block")
            return None

        referral_info = referral_exception.args[0]["info"]
        if not referral_info.startswith("Referral:\n"):
            logger.debug("LDAP referral missing Referral header")
            return None

        referral_uri = referral_info[len("Referral:\n") :]
        if not referral_uri.startswith("ldap:///"):
            logger.debug("LDAP referral URI does not start with ldap:///")
            return None

        referral_dn = referral_uri[len("ldap:///") :]
        return referral_dn

    def _add_filter(self, query, user_filter):
        if not query.startswith("(") or not query.endswith(")"):
            query = "(%s)" % query

        if not user_filter.startswith("(") or not user_filter.endswith(")"):
            user_filter = "(%s)" % user_filter

        assert user_filter.startswith("(") and user_filter.endswith(")")
        assert query.startswith("(") and query.endswith(")")
        return "(&{0}{1})".format(query, user_filter)

    def _add_user_filter(self, query):
        if not self._ldap_user_filter:
            return query

        user_filter = self._ldap_user_filter

        return self._add_filter(query, self._ldap_user_filter)

    def _add_superuser_filter(self, query):
        assert self._ldap_superuser_filter
        return self._add_filter(query, self._ldap_superuser_filter)

    def _add_global_readonly_superuser_filter(self, query):
        assert self._ldap_global_readonly_superuser_filter
        return self._add_filter(query, self._ldap_global_readonly_superuser_filter)

    def _add_restricted_user_filter(self, query):
        assert self._ldap_restricted_user_filter
        return self._add_filter(query, self._ldap_restricted_user_filter)

    def _ldap_user_search_with_rdn(
        self,
        conn,
        username_or_email,
        user_search_dn,
        suffix="",
        filter_superusers=False,
        filter_restricted_users=False,
        filter_global_readonly_superusers=False,
    ):
        query = "(|({0}={2}{3})({1}={2}{3}))".format(
            self._uid_attr, self._email_attr, escape_filter_chars(username_or_email), suffix
        )

        query = self._add_user_filter(query)

        if filter_restricted_users:
            if not self._ldap_restricted_user_filter:
                return (None, "Username not found")

            query = self._add_restricted_user_filter(query)

        elif filter_superusers:
            if not self._ldap_superuser_filter:
                return (None, "Superuser username not found")

            query = self._add_superuser_filter(query)
        elif filter_global_readonly_superusers:
            if not self._ldap_global_readonly_superuser_filter:
                return (None, "Global readonly superuser username not found")

            query = self._add_global_readonly_superuser_filter(query)

        logger.debug("Conducting user search: %s under %s", query, user_search_dn)
        try:
            return (conn.search_s(user_search_dn, ldap.SCOPE_SUBTREE, query), None)
        except ldap.REFERRAL as re:
            referral_dn = self._get_ldap_referral_dn(re)
            if not referral_dn:
                return (None, "Failed to follow referral when looking up username")

            try:
                subquery = "(%s=%s)" % (self._uid_attr, username_or_email)
                subquery = self._add_user_filter(subquery)
                return (conn.search_s(referral_dn, ldap.SCOPE_BASE, subquery), None)
            except ldap.LDAPError:
                logger.debug("LDAP referral search exception")
                return (None, "Username not found")

        except ldap.LDAPError:
            logger.debug("LDAP search exception")
            return (None, "Username not found")

    def _ldap_user_search(
        self,
        username_or_email,
        limit=20,
        suffix="",
        filter_superusers=False,
        filter_restricted_users=False,
        filter_global_readonly_superusers=False,
    ):
        if not username_or_email:
            return (None, "Empty username/email")

        try:
            lookup_robot(username_or_email)
            return (None, f"LDAP lookup for robots disabled {username_or_email}")
        except InvalidRobotException:
            # continue with LDAP lookup
            pass

        # Verify the admin connection works first. We do this here to avoid wrapping
        # the entire block in the INVALID CREDENTIALS check.
        try:
            with self._ldap.get_connection():
                pass
        except ldap.INVALID_CREDENTIALS:
            return (None, "LDAP Admin dn or password is invalid")

        with self._ldap.get_connection() as conn:
            logger.debug("Incoming username or email param: %s", username_or_email.__repr__())

            for user_search_dn in self._user_dns:
                (pairs, err_msg) = self._ldap_user_search_with_rdn(
                    conn,
                    username_or_email,
                    user_search_dn,
                    suffix=suffix,
                    filter_superusers=filter_superusers,
                    filter_restricted_users=filter_restricted_users,
                    filter_global_readonly_superusers=filter_global_readonly_superusers,
                )
                if pairs is not None and len(pairs) > 0:
                    break

            if err_msg is not None:
                return (None, err_msg)

            dn_lst = [pair[0] for pair in pairs]
            logger.debug("Found matching DNs: %s" % dn_lst)

            results = [LDAPUsers._LDAPResult(*pair) for pair in take(limit, pairs)]

            # Filter out pairs without DNs. Some LDAP impls will return such pairs.
            with_dns = [result for result in results if result.dn]
            return (with_dns, None)

    def _ldap_single_user_search(
        self,
        username_or_email,
        filter_superusers=False,
        filter_restricted_users=False,
        filter_global_readonly_superusers=False,
    ):
        try:
            lookup_robot(username_or_email)
            return (None, f"LDAP lookup for robots disabled {username_or_email}")
        except InvalidRobotException:
            # continue with LDAP lookup
            pass

        with_dns, err_msg = self._ldap_user_search(
            username_or_email,
            filter_superusers=filter_superusers,
            filter_restricted_users=filter_restricted_users,
            filter_global_readonly_superusers=filter_global_readonly_superusers,
        )
        if err_msg is not None:
            return (None, err_msg)

        # Make sure we have at least one result.
        if len(with_dns) < 1:
            return (None, "Invalid username or password.")

        # If we have found a single pair, then return it.
        if len(with_dns) == 1:
            return (with_dns[0], None)

        # Otherwise, there are multiple pairs with DNs, so find the one with the mail
        # attribute (if any).
        with_mail = [result for result in with_dns if result.attrs.get(self._email_attr)]
        return (with_mail[0] if with_mail else with_dns[0], None)

    def _build_user_information(self, response):
        if not response.get(self._uid_attr):
            return (None, 'Missing uid field "%s" in user record' % self._uid_attr)

        if self._requires_email and not response.get(self._email_attr):
            return (None, 'Missing mail field "%s" in user record' % self._email_attr)

        try:
            username = response[self._uid_attr][0].decode("utf-8")
        except (UnicodeDecodeError, AttributeError):
            username = response[self._uid_attr][0]
        try:
            email = response.get(self._email_attr, [None])[0].decode("utf-8")
        except (UnicodeDecodeError, AttributeError):
            email = response.get(self._email_attr, [None])[0]

        return (UserInformation(username=username, email=email, id=username), None)

    def ping(self):
        try:
            with self._ldap.get_connection():
                pass
        except ldap.INVALID_CREDENTIALS:
            return (False, "LDAP Admin dn or password is invalid")
        except ldap.LDAPError as lde:
            logger.exception("Exception when trying to health check LDAP")
            return (False, str(lde))

        return (True, None)

    def at_least_one_user_exists(self, filter_superusers=False, filter_restricted_users=False):
        logger.debug("Checking if any users exist in LDAP")
        try:
            with self._ldap.get_connection():
                pass
        except ldap.INVALID_CREDENTIALS:
            return (None, "LDAP Admin dn or password is invalid")

        has_pagination = not self._force_no_pagination
        with self._ldap.get_connection() as conn:
            for user_search_dn in self._user_dns:
                search_flt = "(objectClass=*)"

                search_flt = self._add_user_filter(search_flt)

                if filter_restricted_users:
                    if self._ldap_restricted_user_filter:
                        search_flt = self._add_restricted_user_filter(search_flt)
                    else:
                        return (False, "Superuser filter not set")
                elif filter_superusers:
                    if self._ldap_superuser_filter:
                        search_flt = self._add_superuser_filter(search_flt)
                    else:
                        return (False, "Restricted user filter not set")

                lc = ldap.controls.libldap.SimplePagedResultsControl(
                    criticality=True, size=1, cookie=""
                )
                try:
                    if has_pagination:
                        msgid = conn.search_ext(
                            user_search_dn, ldap.SCOPE_SUBTREE, search_flt, serverctrls=[lc]
                        )
                        _, rdata, _, serverctrls = conn.result3(msgid)
                    else:
                        msgid = conn.search(user_search_dn, ldap.SCOPE_SUBTREE, search_flt)
                        _, rdata = conn.result(msgid)

                    for entry in rdata:  # Handles both lists and iterators.
                        return (True, None)

                except ldap.LDAPError as lde:
                    return (False, str(lde) or "Could not find DN %s" % user_search_dn)

        return (False, None)

    def get_user(self, username_or_email):
        """
        Looks up a username or email in LDAP.
        """
        logger.debug("Looking up LDAP username or email %s", username_or_email)
        (found_user, err_msg) = self._ldap_single_user_search(username_or_email)
        if err_msg is not None:
            return (None, err_msg)

        logger.debug("Found user for LDAP username or email %s", username_or_email)
        _, found_response = found_user
        return self._build_user_information(found_response)

    def query_users(self, query, limit=20):
        """
        Queries LDAP for matching users.
        """
        if not query:
            return (None, self.federated_service, "Empty query")

        logger.debug("Got query %s with limit %s", query, limit)
        (results, err_msg) = self._ldap_user_search(query, limit=limit, suffix="*")
        if err_msg is not None:
            return (None, self.federated_service, err_msg)

        final_results = []
        for result in results[0:limit]:
            credentials, err_msg = self._build_user_information(result.attrs)
            if err_msg is not None:
                continue

            final_results.append(credentials)

        logger.debug("For query %s found results %s", query, final_results)
        return (final_results, self.federated_service, None)

    def verify_credentials(self, username_or_email, password):
        """
        Verify the credentials with LDAP.
        """
        # Make sure that even if the server supports anonymous binds, we don't allow it
        if not password:
            return (None, "Anonymous binding not allowed.")

        (found_user, err_msg) = self._ldap_single_user_search(username_or_email)
        if found_user is None:
            return (None, err_msg)

        found_dn, found_response = found_user
        logger.debug("Found user for LDAP username %s; validating password", username_or_email)
        logger.debug("DN %s found: %s", found_dn, found_response)

        # First validate the password by binding as the user
        try:
            with LDAPConnection(self._ldap_uri, found_dn, password, self._allow_tls_fallback):
                pass
        except ldap.REFERRAL as re:
            referral_dn = self._get_ldap_referral_dn(re)
            if not referral_dn:
                return (None, "Invalid username or password.")

            try:
                with LDAPConnection(
                    self._ldap_uri, referral_dn, password, self._allow_tls_fallback
                ):
                    pass
            except ldap.INVALID_CREDENTIALS:
                logger.debug("Invalid LDAP credentials")
                return (None, "Invalid username or password.")

        except ldap.INVALID_CREDENTIALS:
            logger.debug("Invalid LDAP credentials")
            return (None, "Invalid username or password.")

        return self._build_user_information(found_response)

    def service_metadata(self):
        return {
            "base_dn": self._base_dn,
        }

    def check_group_lookup_args(self, group_lookup_args, disable_pagination=False):
        if not group_lookup_args.get("group_dn"):
            return (False, "Missing group_dn")

        (it, err) = self.iterate_group_members(
            group_lookup_args, page_size=1, disable_pagination=disable_pagination
        )
        if err is not None:
            return (False, err)

        if not next(it, False):
            return (False, "Group does not exist or is empty")

        return (True, None)

    def iterate_group_members(self, group_lookup_args, page_size=None, disable_pagination=False):
        try:
            with self._ldap.get_connection():
                pass
        except ldap.INVALID_CREDENTIALS:
            return (None, "LDAP Admin dn or password is invalid")

        group_dn = group_lookup_args["group_dn"]
        memberof_attr = self._memberof_attr
        page_size = page_size or _DEFAULT_PAGE_SIZE
        return (self._iterate_members(group_dn, memberof_attr, page_size, disable_pagination), None)

    def is_superuser(self, username_or_email: str) -> bool:
        if not username_or_email:
            return False

        try:
            lookup_robot(username_or_email)
            return False  # Robots are not in LDAP so return False as not being a superuser
        except InvalidRobotException:
            # continue with LDAP lookup
            pass

        logger.debug("Looking up LDAP superuser username or email %s", username_or_email)
        (found_user, err_msg) = self._ldap_single_user_search(
            username_or_email, filter_superusers=True
        )
        if found_user is None:
            logger.debug("LDAP superuser %s not found: %s", username_or_email, err_msg)
            return False

        logger.debug("Found superuser for LDAP username or email %s", username_or_email)
        return True

    def has_superusers(self) -> bool:
        has_superusers, _ = self.at_least_one_user_exists(filter_superusers=True)
        return has_superusers

    def is_global_readonly_superuser(self, username_or_email: str) -> bool:
        if not username_or_email:
            return False

        try:
            lookup_robot(username_or_email)
            return False  # Robots are not in LDAP so return False as not being a superuser
        except InvalidRobotException:
            # continue with LDAP lookup
            pass

        logger.debug(
            "Looking up LDAP global readonly superuser username or email %s", username_or_email
        )
        (found_user, err_msg) = self._ldap_single_user_search(
            username_or_email, filter_global_readonly_superusers=True
        )
        if found_user is None:
            logger.debug(
                "LDAP global readonly superuser %s not found: %s", username_or_email, err_msg
            )
            return False

        logger.debug(
            "Found global readonly superuser for LDAP username or email %s", username_or_email
        )
        return True

    def is_restricted_user(self, username_or_email: str) -> bool:
        if not username_or_email:
            return False

        if self._ldap_restricted_user_filter is None:
            return True

        try:
            lookup_robot(username_or_email)
            return False  # Robots are not in LDAP so return False as not being a superuser
        except InvalidRobotException:
            # continue with LDAP lookup
            pass

        logger.debug("Looking up LDAP restricted user username or email %s", username_or_email)
        (found_user, err_msg) = self._ldap_single_user_search(
            username_or_email, filter_restricted_users=True
        )
        if found_user is None:
            logger.debug("LDAP user %s not found: %s", username_or_email, err_msg)
            return False

        logger.debug("Found restricted user for LDAP username or email %s", username_or_email)
        return True

    def has_restricted_users(self) -> bool:
        if self._ldap_restricted_user_filter is None and self.at_least_one_user_exists():
            return True

        has_restricted_users, _ = self.at_least_one_user_exists(filter_restricted_users=True)
        return has_restricted_users

    def _iterate_members(self, group_dn, memberof_attr, page_size, disable_pagination):
        has_pagination = not (self._force_no_pagination or disable_pagination)
        with self._ldap.get_connection() as conn:
            search_flt = filter_format("(%s=%s,%s)", (memberof_attr, group_dn, self._base_dn))
            search_flt = self._add_user_filter(search_flt)

            attributes = [self._uid_attr, self._email_attr]

            for user_search_dn in self._user_dns:
                lc = ldap.controls.libldap.SimplePagedResultsControl(
                    criticality=True, size=page_size, cookie=""
                )

                # Conduct the initial search for users that are a member of the group.
                logger.debug(
                    "Conducting LDAP search of DN: %s and filter %s", user_search_dn, search_flt
                )
                try:
                    if has_pagination:
                        msgid = conn.search_ext(
                            user_search_dn,
                            ldap.SCOPE_SUBTREE,
                            search_flt,
                            serverctrls=[lc],
                            attrlist=attributes,
                        )
                    else:
                        msgid = conn.search(
                            user_search_dn, ldap.SCOPE_SUBTREE, search_flt, attrlist=attributes
                        )
                except ldap.LDAPError as lde:
                    logger.exception(
                        "Got error when trying to search %s with filter %s: %s",
                        user_search_dn,
                        search_flt,
                        str(lde),
                    )
                    break

                while True:
                    found_results = 0
                    try:
                        if has_pagination:
                            _, rdata, _, serverctrls = conn.result3(msgid)
                        else:
                            _, rdata = conn.result(msgid)

                        # Yield any users found.
                        for userdata in rdata:
                            found_results = found_results + 1
                            if isinstance(userdata[1], list):
                                # we do not follow referrals here
                                continue
                            yield self._build_user_information(userdata[1])

                        logger.debug(
                            "Found %s users in group %s; %s",
                            found_results,
                            user_search_dn,
                            search_flt,
                        )
                    except ldap.NO_SUCH_OBJECT as nsoe:
                        logger.debug(
                            "NSO when trying to lookup results of search %s with filter %s: %s",
                            user_search_dn,
                            search_flt,
                            str(nsoe),
                        )
                    except ldap.LDAPError as lde:
                        logger.exception(
                            "Error when trying to lookup results of search %s with filter %s: %s",
                            user_search_dn,
                            search_flt,
                            str(lde),
                        )
                        break

                    # If no additional results, nothing more to do.
                    if not found_results:
                        break

                    # If pagination is disabled, nothing more to do.
                    if not has_pagination:
                        logger.debug("Pagination is disabled, no further queries")
                        break

                    # Filter down the controls with which the server responded, looking for the paging
                    # control type. If not found, then the server does not support pagination and we already
                    # got all of the results.
                    pctrls = [
                        control
                        for control in serverctrls
                        if control.controlType
                        == ldap.controls.SimplePagedResultsControl.controlType
                    ]

                    if pctrls:
                        # Server supports pagination. Update the cookie so the next search finds the next page,
                        # then conduct the next search.
                        cookie = lc.cookie = pctrls[0].cookie
                        if cookie:
                            logger.debug(
                                "Pagination is supported for this LDAP server; trying next page"
                            )
                            msgid = conn.search_ext(
                                user_search_dn,
                                ldap.SCOPE_SUBTREE,
                                search_flt,
                                serverctrls=[lc],
                                attrlist=attributes,
                            )
                            continue
                        else:
                            # No additional results.
                            logger.debug(
                                "Pagination is supported for this LDAP server but on last page"
                            )
                            break
                    else:
                        # Pagination is not supported.
                        logger.debug("Pagination is not supported for this LDAP server")
                        break
