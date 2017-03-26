import {assert} from 'chai';
import sinon from 'sinon';
import {ACCEPTED, NO_CONTENT, BAD_REQUEST, INTERNAL_SERVER_ERROR} from 'http-status-codes';
import any from '@travi/any';
import * as actionsFactory from '../../src/github/actions';
import * as greenkeeper from '../../src/greenkeeper';
import * as process from '../../src/process';
import handler from '../../src/handler';

suite('handler', () => {
  let sandbox, reply, code;
  const githubCredentials = {token: any.string()};
  const settings = {...any.simpleObject(), github: githubCredentials};
  const log = sinon.spy();

  setup(() => {
    reply = sinon.stub();
    code = sinon.spy();

    sandbox = sinon.sandbox.create();

    reply.withArgs('skipping').returns({code});
  });

  teardown(() => {
    sandbox.restore();
    log.reset();
  });

  suite('`pull_request` event', () => {
    const greenkeeperSender = any.url();

    setup(() => {
      sandbox.stub(process, 'default').resolves();
      sandbox.stub(greenkeeper, 'default')
        .returns(false)
        .withArgs(greenkeeperSender).returns(true);
    });

    test('that response is accepted when pr was opened by greenkeeper and is then processed', () => {
      const request = {
        payload: {
          action: 'opened',
          sender: {
            html_url: greenkeeperSender
          }
        },
        headers: {'x-github-event': 'pull_request'},
        log: () => undefined
      };
      reply.withArgs('ok').returns({code});

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, ACCEPTED);
        assert.calledWith(process.default, request, settings);
      });
    });

    test('that response is bad-request when the webhook action is not `opened`', () => {
      const request = {
        payload: {
          action: any.word(),
          sender: {
            html_url: greenkeeperSender
          }
        },
        headers: {'x-github-event': 'pull_request'},
        log
      };

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, BAD_REQUEST);
        assert.calledWith(log, ['PR', 'skipping']);
      });
    });

    test('that response is bad-request when pr not opened by greenkeeper', () => {
      const request = {
        payload: {
          action: 'opened',
          sender: {
            html_url: any.url()
          }
        },
        headers: {'x-github-event': 'pull_request'},
        log
      };

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, BAD_REQUEST);
        assert.calledWith(log, ['PR', 'skipping']);
      });
    });
  });

  suite('`status` event', () => {
    let getPullRequestsForCommit;

    setup(() => {
      getPullRequestsForCommit = sinon.stub();

      sandbox.stub(actionsFactory, 'default').withArgs(githubCredentials).returns({getPullRequestsForCommit});
    });

    test('that the response is accepted when the event is a successful status and a matching greenkeeper PR', () => {
      const repository = any.simpleObject();
      const branch = any.string();
      const request = {
        payload: {
          state: 'success',
          repository,
          branches: [{name: branch}]
        },
        headers: {'x-github-event': 'status'},
        log: () => undefined
      };
      reply.withArgs('ok').returns({code});
      getPullRequestsForCommit.withArgs({repo: repository, ref: branch}).resolves([{}]);

      return handler(request, reply, settings).then(() => assert.calledWith(code, ACCEPTED));
    });

    test('that the response is bad-request when the state is not `success`', () => {
      const request = {
        payload: {state: any.string()},
        headers: {'x-github-event': 'status'},
        log
      };

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, BAD_REQUEST);
        assert.calledWith(log, ['PR', 'skipping']);
      });
    });

    test('that the response is bad-request when commit is on multiple branches', () => {
      const request = {
        payload: {state: 'success', branches: [{}, {}]},
        headers: {'x-github-event': 'status'},
        log
      };

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, BAD_REQUEST);
        assert.calledWith(log, ['PR', 'skipping']);
      });
    });

    test('that the response is bad-request when commit is on master', () => {
      const request = {
        payload: {state: 'success', branches: [{name: 'master'}]},
        headers: {'x-github-event': 'status'},
        log
      };

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, BAD_REQUEST);
        assert.calledWith(log, ['PR', 'skipping']);
      });
    });

    test('that the response is bad-request if there are no PRs for the commit', () => {
      const request = {
        payload: {state: 'success', branches: [{name: any.string()}]},
        headers: {'x-github-event': 'status'},
        log: () => undefined
      };
      getPullRequestsForCommit.resolves([]);
      reply.withArgs('no PRs for this commit').returns({code});

      return handler(request, reply, settings).then(() => assert.calledWith(code, BAD_REQUEST));
    });

    test('that a server-error is reported if the fetching of related PRs fails', () => {
      const request = {
        payload: {
          state: 'success',
          repository: any.string(),
          branches: [{name: any.string()}]
        },
        headers: {'x-github-event': 'status'},
        log: () => undefined
      };
      getPullRequestsForCommit.rejects(new Error(any.string()));
      reply.withArgs('failed to fetch PRs').returns({code});

      return handler(request, reply, settings).then(() => assert.calledWith(code, INTERNAL_SERVER_ERROR));
    });
  });

  suite('`ping` event', () => {
    test('that a 204 response is provided for a ping request', () => {
      const request = {
        payload: {
          hook: {
            config: {
              content_type: 'json'
            }
          }
        },
        headers: {'x-github-event': 'ping'},
        log: () => undefined
      };
      reply.withArgs('successfully configured the webhook for greenkeeper-keeper').returns({code});

      return handler(request, reply, settings).then(() => assert.calledWith(code, NO_CONTENT));
    });

    test('that a 400 response is sent when the ping shows that the hook is not configured to send json', () => {
      const request = {
        payload: {
          hook: {
            config: {
              content_type: 'form'
            }
          }
        },
        headers: {'x-github-event': 'ping'},
        log: () => undefined
      };
      reply.withArgs('please update your webhook configuration to send application/json').returns({code});

      return handler(request, reply, settings).then(() => assert.calledWith(code, BAD_REQUEST));
    });
  });

  suite('other statuses', () => {
    test('that response is bad-request when the webhook event is not `pull_request` or `status', () => {
      const request = {
        payload: {},
        headers: {'x-github-event': any.word()},
        log
      };

      return handler(request, reply, settings).then(() => {
        assert.calledWith(code, BAD_REQUEST);
        assert.calledWith(log, ['PR', 'skipping']);
      });
    });
  });
});