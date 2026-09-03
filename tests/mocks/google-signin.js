export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => ({
    type: 'success',
    data: {
      user: {
        id: '12345',
        email: 'paytrack.user@gmail.com',
        name: 'PayTrack User',
      },
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    },
  }),
  getTokens: async () => ({
    idToken: 'mock_id_token',
    accessToken: 'ya29.mock_native_access_token',
  }),
  signOut: async () => null,
  revokeAccess: async () => null,
  clearCachedAccessToken: async () => null,
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

export default { GoogleSignin, statusCodes };
