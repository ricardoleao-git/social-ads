export interface InstagramAuthService {
  isAuthenticated: () => boolean;
  getAccessToken: () => string | null;
  authorize: () => Promise<void>;
  logout: () => void;
}
export const instagramAuthService: InstagramAuthService = {
  isAuthenticated: () => false,
  getAccessToken: () => null,
  authorize: async () => { console.log('Instagram auth not configured'); },
  logout: () => {},
};
export default instagramAuthService;
