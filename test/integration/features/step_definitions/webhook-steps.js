import {defineSupportCode} from 'cucumber';
import any from '@travi/any';
import {assert} from 'chai';
import {BAD_REQUEST} from 'http-status-codes';
import {World} from '../support/world';

defineSupportCode(({Given, Then, setWorldConstructor}) => {
  setWorldConstructor(World);

  Given(/^the webhook is for a (.*) event and a (.*) action$/, function (event, action, callback) {
    this.webhookAction = action;
    this.webhookEventName = event;

    callback();
  });

  Given(/^the webhook is for a status event and a (.*) state$/, function (state, callback) {
    this.webhookEventName = 'status';
    this.statusEventState = state;

    callback();
  });

  Given(/^the webhook is for a check_run event and a (.*) status$/, async function (status) {
    this.checkRunEventStatus = status;
    this.webhookEventName = 'check_run';
  });

  Given(
    /^the webhook is for a check_run event, a completed status, and a (.*) conclusion$/,
    async function (conclusion) {
      this.webhookEventName = 'check_run';
      this.checkRunEventStatus = 'completed';
      this.checkRunEventConclusion = conclusion;
    }
  );

  Given(/^the commit is only on one, non-master branch$/, function (callback) {
    this.commitBranches = [any.word()];

    callback();
  });

  Given(/^the commit is on multiple branches$/, function (callback) {
    this.commitBranches = [any.word(), any.word()];

    callback();
  });

  Given(/^the commit is on the master branch$/, function (callback) {
    this.commitBranches = ['master'];

    callback();
  });

  Then(/^the webhook response indicates that the webhook will be skipped$/, function (callback) {
    assert.oneOf(
      this.serverResponse.payload,
      ['skipping', 'no PRs for this commit', `PR is not from greenkeeper, but from ${this.prSender}`]
    );
    assert.equal(this.getResponseStatus(), BAD_REQUEST);

    callback();
  });
});
