export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}
