%rebase base title='Entitity: {{entity["label"]f}}', debug=debug, session=session
<h1>Entity: {{entity['label']}}</h1>
<h2>IP Addresses</h2>
<ul>
%for label, ip in entity['ip_addresses'].items():
    <li>{{label}}: {{ip}}</li>
%end
</ul>

<h2>Checks</h2>
<ul>
%for check in checks:
    <li>
        <p>Check: {{check['label']}}</p>
        <p>Type: {{check['type']}}</p>

    </li>
%end
</ul>