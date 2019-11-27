import { Stream2 } from "./index";
import { EndPointAC } from './end-point-ac';
import { TTMP } from './wsp';


export class EndPoint extends EndPointAC {

  registerSubscriber( connect, subscriber ) {
    super.registerSubscriber( connect, subscriber );
    if(this.curFrameCachedRecord && this.curFrameCachedRecord.token === TTMP.get()) {
      // if deactivation occurred earlier than the subscription
      if(this.connections.has(connect)) {
        subscriber(this.curFrameCachedRecord);
      }
    }
  }

}

/**
 * Кеширует соединение линии потока, чтобы новые стримы не создавались
 */
Stream2.prototype.endpoint = function() {
  return new EndPoint( (connect, control) => {
    this.connect((evtChWSpS, hook, own) => {
      control.to(hook);
      return connect( evtChWSpS, own );
    });
  } );
};