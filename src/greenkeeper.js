export const GREENKEEPER_BOT_GITHUB_URL = 'https://github.com/marketplace/greenkeeper';
export const GREENKEEPER_INTEGRATION_GITHUB_URL = 'https://github.com/apps/greenkeeper';

export default function (sender) {
  return GREENKEEPER_INTEGRATION_GITHUB_URL === sender || GREENKEEPER_BOT_GITHUB_URL === sender;
}
