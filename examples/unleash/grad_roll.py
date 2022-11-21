from UnleashClient import UnleashClient


unleash_instance_id = "unleash-python-client"
app_name = "test-client"
custom_options = {}
UNLEASH_API_TOKEN = "default:development.unleash-insecure-api-token"
UNLEASH_URL = "http://localhost:4242/api"
UNLEASH_ENVIRONMENT = "development"
UNLEASH_APP_NAME = "quay"

custom_headers = {"Authorization": UNLEASH_API_TOKEN}
unleash_client = UnleashClient(
    url=UNLEASH_URL,
    instance_id=unleash_instance_id,
    app_name=UNLEASH_APP_NAME,
    environment=UNLEASH_ENVIRONMENT,
    custom_headers=custom_headers,
)

unleash_client.initialize_client()

params = [(0, 2), (0, 10), (0, 33), (0, 100), (0, 300), (0, 1000), (0, 10000)]

for param in params:
    enabled = 0
    disabled = 0
    session_start = param[0]
    session_end = param[1]

    for id in range(session_start, session_end):
        result = unleash_client.is_enabled("test", {"sessionId": str(id)})
        if result:
            enabled += 1
        else:
            disabled += 1
    enabled_percent = enabled / (session_end - session_start) * 100
    disabled_percent = disabled / (session_end - session_start) * 100
    print(f"Total number of sessions: {session_end}")
    print(f"Enabled: {enabled_percent}%")
    print(f"Disabled: {disabled_percent}%")
    print("========================================")
