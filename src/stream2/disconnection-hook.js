export default class DisconnectionHook {
	
	constructor() {
		this.onDisconnectTasks = [];
	}
	
	onDisconnect( ...tasks ) {
		this.onDisconnectTasks.push( ...tasks );
	}
	
	disconnect() {
		this.onDisconnectTasks.map( task => task() );
	}
	
}