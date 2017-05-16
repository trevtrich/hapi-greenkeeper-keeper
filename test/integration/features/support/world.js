import any from '@travi/any';

function buildWebhookPayload(event, {action, prDetails, statusEventDetails, ref, repo}) {
  if ('pull_request' === event) {
    return {
      action,
      sender: {
        html_url: prDetails.sender
      },
      number: prDetails.number,
      pull_request: {
        number: prDetails.number,
        comments_url: `https://api.github.com${prDetails.comments}`,
        url: 'https://api.github.com/123',
        head: {
          sha: prDetails.sha,
          ref,
          repo: {
            full_name: repo
          }
        }
      }
    };
  }

  if ('status' === event) {
    return {
      state: statusEventDetails.state,
      repository: {
        full_name: repo,
        owner: {
          login: statusEventDetails.repoOwner
        }
      },
      ...statusEventDetails.branches && {branches: statusEventDetails.branches.map(branch => ({name: branch}))}
    };
  }

  return {};
}

export function World() {
  this.githubUser = any.word();
  this.githubToken = any.word();
  this.sha = any.string();
  this.ref = any.word();
  this.prNumber = any.integer();
  this.repo = 'test-repo';

  this.receiveWebhook = ({event, action, prDetails, statusEventDetails}) => this.server.inject({
    method: 'POST',
    url: '/payload',
    headers: {
      'X-GitHub-Event': event
    },
    payload: buildWebhookPayload(
      event,
      {action, prDetails, statusEventDetails, ref: this.ref, repo: this.repo}
    )
  });

  this.getResponseStatus = () => this.serverResponse.statusCode;
}
