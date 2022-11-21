from UnleashClient import UnleashClient
from UnleashClient.api.features import get_feature_toggles
from pprint import pprint
import time

unleash_instance_id = "unleash-python-client"
app_name = "test-client"
custom_options = {}
# UNLEASH_API_TOKEN = "*:*.e45fd2344eb89c6521eef8d0c4939a2ca87f6c0d5403d6c362039d2a"
UNLEASH_API_TOKEN = "*:development.ee52226db76c9b32e6086e1df22fb2c27a8f909e0c0b12740f1c2215"
UNLEASH_URL = "http://localhost:4242/api"
UNLEASH_ENVIRONMENT = "development"
UNLEASH_APP_NAME = "quay"

context = {}
custom_headers = {"Authorization": UNLEASH_API_TOKEN}
unleash_client = UnleashClient(
    url=UNLEASH_URL,
    instance_id=unleash_instance_id,
    app_name=UNLEASH_APP_NAME,
    environment=UNLEASH_ENVIRONMENT,
    custom_headers=custom_headers,
)

unleash_client.initialize_client()

(result, _) = get_feature_toggles(
    UNLEASH_URL,
    UNLEASH_APP_NAME,
    unleash_instance_id,
    custom_headers,
    custom_options,
    project="default",
)

pprint(result)

print(unleash_client.is_enabled("FEATURE_UI_V2", context))
