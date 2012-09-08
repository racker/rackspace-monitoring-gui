import inspect
import bottle

class Session(dict):
    _cookie_name = None
    _cookie_secret = None

    def __init__(self, cookie_name, cookie_secret):
        self._cookie_name = cookie_name
        self._cookie_secret = cookie_secret
        session = bottle.request.get_cookie(self._cookie_name, secret=self._cookie_secret) or {}
        if not self._validate(session):
            session = {}
        super(Session, self).__init__(session)

    @classmethod
    def _validate(cls, session):
        for key in ['username', 'auth_token', 'url']:
            if not session.get(key):
                return False
        return True

    def is_valid(self):
        return self.__class__._validate(self)

    def save(self):
        bottle.response.set_cookie(self._cookie_name, self, secret=self._cookie_secret)

    def logout(self):
        bottle.response.delete_cookie(self._cookie_name)
        self.clear()

class RequireSession(object):
    name = 'require_session'
    api = 2

    def apply(self, callback, context):
        def wrapper(*args, **kwargs):
            if kwargs.get('session') and kwargs.get('session').is_valid():
                return callback(*args, **kwargs)
            else:
                return bottle.redirect('/login')
        return wrapper

class SessionPlugin(object):
    name = 'session'
    api = 2

    def __init__(self, cookie_name, cookie_secret, keyword='session'):
         self.cookie_name = cookie_name
         self.cookie_secret = cookie_secret
         self.keyword = keyword

    def setup(self, app):
        ''' Make sure that other installed plugins don't affect the same
            keyword argument.'''
        for other in app.plugins:
            if not isinstance(other, Session): continue
            if other.keyword == self.keyword:
                raise PluginError("Found another session plugin with "\
                "conflicting settings (non-unique keyword).")

    def apply(self, callback, context):
        # Test if the original callback accepts a 'session' keyword.
        args = inspect.getargspec(context.callback)[0]
        if self.keyword not in args:
            return callback

        def wrapper(*args, **kwargs):
            session = Session(cookie_name=self.cookie_name, cookie_secret=self.cookie_secret)
            kwargs[self.keyword] = session

            return callback(*args, **kwargs)

        # Replace the route callback with the wrapped one.
        return wrapper
