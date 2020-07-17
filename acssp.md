### Подключение к каналу
response: 
```json5
{
  kind: 'CONNECTION',
  clienID: 65464,
}
```
### Подписка на поток
request:
```json5
{
  kind: 'SUBSCRIBE',
  path: './namespace/acc',
  // subscriptionID: 12345,
  // args: null,
}
```
response:
```json5
{
  kind: 'INIT',
  path: './namespace/acc', // vs subscriptionID: 12345,
  data: { /* Initial DATA*/ }
}
```
Повторная подписка на тот же поток приводит к повторной отправке INIT
### Отписка
```json5
{
  kind: 'UNSUBSCRIBE',
  path: './namespace/acc/',
  // args: null,
}
```
Одна отписка отменяет все существующие подписки
### Рассылка сresponse:обытий сервера на подписанный поток

```json5
{
  kind: 'PUSH',
  path: './namespace/acc', // vs subscriptionID: 12345,
  data: { /* Action, data */ },
  eventID: 'UNIQUE_ID_HASH', // vs clientID + eventID counter
}
```
### Реакция на события клиента на подписанный поток
request:
```json5
{
  kind: 'COORDINATE',
  path: './namespace/acc', // vs subscriptionID: 12345,
  eventID: 'UNIQUE_ID_HASH', // vs clientID + eventID counter
  data: { /* Action, data */ },
}
```
response:
```json5
{
  kind: 'STATUS_UPDATE',
  path: './namespace/acc', // vs subscriptionID: 12345,
  status: 'success', // or failure
  err: null,
}
```