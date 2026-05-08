AUTH_RESPONSES = {
    401: {"description": "Missing or invalid bearer token"},
}

BAD_REQUEST_RESPONSE = {
    400: {"description": "Malformed request or business-rule validation error"},
}

FORBIDDEN_RESPONSE = {
    403: {"description": "Forbidden"},
}

CONFLICT_RESPONSE = {
    409: {"description": "Resource already exists or conflicts with current state"},
}

NOT_FOUND_RESPONSE = {
    404: {"description": "Requested resource was not found"},
}

SERVER_ERROR_RESPONSE = {
    500: {"description": "Internal server error"},
}

PROTECTED_RESPONSES = {
    **AUTH_RESPONSES,
    **BAD_REQUEST_RESPONSE,
    **NOT_FOUND_RESPONSE,
}
