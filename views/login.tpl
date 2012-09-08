%rebase base title='Login', debug=debug, session=session
<div class="row-fluid">
<div class="span6 offset3">
%if errors:
  %for error in errors:
    <div class="alert alert-error">
      {{error}}
    </div>
  %end
%end
<form class="form-horizontal" action="/login" method="POST">
  <div class="control-group">
    <label class="control-label" for="username">Username</label>
    <div class="controls">
      <input type="text" name="username" id="username" placeholder="username">
    </div>
  </div>
  <div class="control-group">
    <label class="control-label" for="password">Password</label>
    <div class="controls">
      <input type="password" name="password" id="password" placeholder="password">
    </div>
  </div>
  <div class="control-group">
    <div class="controls">
      <label class="checkbox">
        <input type="checkbox"> Remember me
      </label>
      <button type="submit" class="btn">Sign in</button>
    </div>
  </div>
</form>
</div>
</div>
