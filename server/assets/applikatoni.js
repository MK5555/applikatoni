function Branch(branchJson) {
  this.rawJson = branchJson;
  this.messageLines = this.rawJson.commit.commit.message.split("\n");
}

Branch.prototype.name = function() {
  return this.rawJson.name;
};

Branch.prototype.message = function() {
  var header = this.messageLines[0];
  return header;
};

Branch.prototype.messageBody = function() {
  if (this.messageLines.length < 2) {
    return false;
  } else {
    return this.messageLines.slice(1, this.messageLines.length).join("\n");
  }
};

Branch.prototype.sha = function() {
  return this.rawJson.commit.sha;
};

Branch.prototype.shortSha = function() {
  var longSha = this.sha();
  return longSha.slice(0, 6);
};

Branch.prototype.userName = function() {
  return this.rawJson.commit.author.login;
};

Branch.prototype.userAvatarUrl = function() {
  return this.rawJson.commit.author.avatar_url;
};

Branch.prototype.updatedAt = function() {
  return this.rawJson.commit.commit.committer.date;
}

Branch.prototype.travisImageURL = function() {
  return this.rawJson.travis_image_url;
}

Branch.prototype.travisImageLink = function() {
  return this.rawJson.travis_image_link;
}

$(function() {
  /*
   *  -------------- DETAILS PAGE --------------
   */

  var hoganOptions = {delimiters: '<% %>'};

  var pullTemplate                      = Hogan.compile($('#pullRequestTemplate').text(), hoganOptions);
  var branchTemplate                    = Hogan.compile($('#branchTemplate').text(), hoganOptions);
  var errorMessageTemplate              = Hogan.compile($('#errorMessageTemplate').text(), hoganOptions);
  var logEntryTemplate                  = Hogan.compile($('#logEntryTemplate').text(), hoganOptions);
  var logEntryStageResultTemplate       = Hogan.compile($('#logEntryStageResultTemplate').text(), hoganOptions);
  var logEntryStdoutTemplate            = Hogan.compile($('#logEntryStdoutTemplate').text(), hoganOptions);
  var logEntryStderrTemplate            = Hogan.compile($('#logEntryStderrTemplate').text(), hoganOptions);
  var logEntryCmdSuccessTemplate        = Hogan.compile($('#logEntryCmdSuccessTemplate').text(), hoganOptions);
  var logEntryCmdStartTemplate          = Hogan.compile($('#logEntryCmdStartTemplate').text(), hoganOptions);
  var logEntryCmdFailTemplate           = Hogan.compile($('#logEntryCmdFailTemplate').text(), hoganOptions);
  var logEntryStageStartTemplate        = Hogan.compile($('#logEntryStageStartTemplate').text(), hoganOptions);
  var logEntryStageFailTemplate         = Hogan.compile($('#logEntryStageFailTemplate').text(), hoganOptions);
  var logEntryStageSuccessTemplate      = Hogan.compile($('#logEntryStageSuccessTemplate').text(), hoganOptions);
  var logEntryDeploymentStartTemplate   = Hogan.compile($('#logEntryDeploymentStartTemplate').text(), hoganOptions);
  var logEntryDeploymentFailTemplate    = Hogan.compile($('#logEntryDeploymentFailTemplate').text(), hoganOptions);
  var logEntryDeploymentSuccessTemplate = Hogan.compile($('#logEntryDeploymentSuccessTemplate').text(), hoganOptions);
  var logEntryKillReceivedTemplate      = Hogan.compile($('#logEntryKillReceivedTemplate').text(), hoganOptions);

  var logEntryTemplates = {
    'COMMAND_STDOUT_OUTPUT':   logEntryStdoutTemplate,
    'COMMAND_STDERR_OUTPUT':   logEntryStderrTemplate,
    'COMMAND_START':           logEntryCmdStartTemplate,
    'COMMAND_FAIL':            logEntryCmdFailTemplate,
    'COMMAND_SUCCESS':         logEntryCmdSuccessTemplate,
    'STAGE_START':             logEntryStageStartTemplate,
    'STAGE_FAIL':              logEntryStageFailTemplate,
    'STAGE_SUCCESS':           logEntryStageSuccessTemplate,
    'STAGE_RESULT':            logEntryStageResultTemplate,
    'DEPLOYMENT_START':        logEntryDeploymentStartTemplate,
    'DEPLOYMENT_SUCCESS':      logEntryDeploymentSuccessTemplate,
    'DEPLOYMENT_FAIL':         logEntryDeploymentFailTemplate,
    'KILL_RECEIVED':           logEntryKillReceivedTemplate
  };

  var labelClasses = function (index, css) {
    return (/label-[^\s]+/.exec(css) || []).join(' ');
  };

  var resizeLogs = function() {
    var moreSpaceNoReasonButFancy = 40;
    var max = window.innerHeight - $logEntries.offset().top - moreSpaceNoReasonButFancy;
    $logEntries.css({ overflowY: 'auto', maxHeight: max });
  };

  var $logEntries = $('.logentries');
  var state       = $('.deployment-info').data('deployment-state');
  var stateInfo   = $('.deployment-info').find('[data-attr="state-info"]');
  var path        = $('.deployment-info').data('log-path');
  var $killButton = $('.kill-button');

  if (path) {
    resizeLogs();
    $(window).resize(resizeLogs);

    $killButton.click(function(event) {
      event.preventDefault();

      $.post(window.location.protocol + '//' + $killButton.data('kill-path'));
    });

    var wsScheme = window.location.protocol === 'https:' ? 'wss://': 'ws://';
    var wsPath = wsScheme+path;
    var conn = new WebSocket(wsPath);

    conn.onmessage = function(evt) {
      var logEntry = JSON.parse(evt.data);
      var type     = logEntry.entry_type;
      var template = logEntryTemplates[type];
      var rendered = template.render(logEntry);

      $logEntries.append(rendered);

      if (state !== 'active' && state !== 'new') return;

      $logEntries[0].scrollTop = $logEntries[0].scrollHeight;

      if (type === 'DEPLOYMENT_START') {
        Favicon.startRotation();
      } else if (type === 'DEPLOYMENT_SUCCESS') {
        Favicon.stopRotation();
        stateInfo.removeClass(labelClasses).addClass('label-success').text('Successful');
        $killButton.remove();
      } else if (type === 'DEPLOYMENT_FAIL') {
        Favicon.stopRotation();
        stateInfo.removeClass(labelClasses).addClass('label-danger').text('Failed');
        $killButton.remove();
      } else if (type === 'KILL_RECEIVED') {
        $killButton.attr('disabled', true);
      }
    };
  }


  /*
   *  -------------- INDEX PAGE --------------
   */

  var $pulls    = $('.pulls');
  var pullsPath = $pulls.data('pulls-path');

  var addLoadedPullRequests = function(data) {
    data.forEach(function(pullJson) {
      var rendered = pullTemplate.render(pullJson);
      $pulls.append(rendered);
    });

    $('.deploy-pull-request').click(function(event) {
      var commitSha = $(this).data('pull-request-head-sha');
      var branch    = $(this).data('pull-request-head-ref');

      $('input[name=commitsha]').val(commitSha);
      $('input[name=branch]').val(branch);
    });
  };

  var showPullRequestsError = function(xhr, textstatus, error) {
    var rendered = errorMessageTemplate.render({message: 'Something went wrong while fetching pull requests from GitHub'});
    $pulls.replaceWith(rendered);
  };

  if (pullsPath) {
    $.ajax({
      url: pullsPath,
      dataType: 'json',
      success: addLoadedPullRequests,
      error: showPullRequestsError
    });
  }

  var $branches    = $('.branches');
  var branchesPath = $branches.data('branches-path');

  var addLoadedBranches = function(data) {
    data.forEach(function(branchJson) {
      var branch = new Branch(branchJson);
      var rendered = branchTemplate.render(branch);
      $branches.append(rendered);
    });

    $('.deploy-branch').click(function(event) {
      var commitSha = $(this).data('branch-sha');
      var branch    = $(this).data('branch-name');

      $('input[name=commitsha]').val(commitSha);
      $('input[name=branch]').val(branch);
    });

    $('[data-action=toggle-full-message]').click(function(event) {
      event.preventDefault();
      $(this).parent().find('.message-body').toggleClass('hidden');
    });
  };

  var showBranchesError = function(xhr, textstatus, error) {
    var rendered = errorMessageTemplate.render({message: 'Something went wrong while fetching branch status from GitHub'});
    $branches.replaceWith(rendered);
  };

  if (branchesPath) {
    $.ajax({
      url: branchesPath,
      dataType: 'json',
      success: addLoadedBranches,
      error: showBranchesError
    });
  }

  var activeApplication = (/^\/([^/]+)/).exec(window.location.pathname);
  if (activeApplication) {
    $('.application-list a:contains("' + activeApplication[1] + '")').parent('li').addClass('active');
  }

  var stagesContainer = $('.js-stages-container');
  var allStagesGroups = $('.js-stages-form-group');
  allStagesGroups.filter('.hidden').remove();

  $('select[name="target"]').change(function() {
    var selectedTarget = $(this).val();
    var newStagesGroup = allStagesGroups.filter('[data-target-name="'+selectedTarget+'"]');

    allStagesGroups.remove();
    newStagesGroup.removeClass('hidden');
    stagesContainer.append(newStagesGroup);
  });

  var showAdvancedToggle = $('.js-toggle-advanced');
  showAdvancedToggle.click(function(e) {
    e.preventDefault();

    stagesContainer.toggleClass('hidden');
  });

  $('.js-submit-deployment').clickSpark({
    particleCount: 40,
    particleSize: 15,
    particleSpeed: 8,
    particleImagePath: '/assets/favicon.ico',
    particleRotationSpeed: 20
  });

  $('.js-submit-deployment').click(function(e) {
    e.preventDefault();
    e.stopPropagation();

    var $button = $(e.target);
    $button.prop('disabled', 'disabled');

    clickSpark.fireParticles($(e.target));

    setTimeout(function() {
      $button.parents('form').submit()
    }, 900);
  });
});
