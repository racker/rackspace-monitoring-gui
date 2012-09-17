%rebase base title='Entities', debug=debug, session=session
<h1>Entities</h1>
<ul>
%for e in entities:
    <li><a href="/entities/{{e['id']}}">{{e['label']}}</a></li>
%end
</ul>
