import test from 'ava';
import {RpcClientHandler} from './rpc_client'
import sinon from 'sinon';

test.beforeEach(t => {
	t.context.testBackend = {
		sendMessage: sinon.stub(),
		onResponse: sinon.stub(),
		removeResponseListener: sinon.stub()		
	}
	t.context.client = new Proxy({}, new RpcClientHandler(t.context.testBackend));
});

test('should register a response listener for callbacks', t => {
	t.is(t.context.testBackend.onResponse.firstCall.args.length, 1);
});

test('should handle callbacks.', t => {
	t.is(t.context.testBackend.onResponse.firstCall.args.length, 1);
	// Grab the response listener which is registered on the messaging backend
	const callbackResponseListener = t.context.testBackend.onResponse.firstCall.args[0];
	const testCallback = sinon.stub();
	// Register a callback
	t.context.client.on('test', testCallback);
	// Check registration message
	t.is(t.context.testBackend.sendMessage.firstCall.args.length, 1);
	const cbRegistrationMessage = t.context.testBackend.sendMessage.firstCall.args[0];
	t.is(cbRegistrationMessage.type, 'CALLBACK_REGISTRATION');
	t.is(cbRegistrationMessage.args.length, 2);
	t.is(cbRegistrationMessage.args[0].type, 'string')
	t.is(cbRegistrationMessage.args[1].type, 'function')
	const callbackArgument = cbRegistrationMessage.args[1];
	// Trigger a callback response
	callbackResponseListener({ type: 'CALLBACK', id: callbackArgument.id, args: ['firstArg', 'secondArg'] });
	t.is(testCallback.callCount, 1);
	t.deepEqual(testCallback.firstCall.args, ['firstArg', 'secondArg']);

	// Deregister callback
	t.context.client.off('test', testCallback);
	// Check message
	t.is(t.context.testBackend.sendMessage.callCount, 2);
	const cbDeregistrationMessage = t.context.testBackend.sendMessage.secondCall.args[0];
	t.is(cbDeregistrationMessage.type, 'CALLBACK_DEREGISTRATION');
	t.is(cbDeregistrationMessage.args.length, 2);
	t.is(cbDeregistrationMessage.args[0].type, 'string')
	t.is(cbDeregistrationMessage.args[1].type, 'function')

	callbackResponseListener({ type: 'CALLBACK', id: cbDeregistrationMessage.args[1].id, args: ['firstArg']});
	t.is(testCallback.callCount, 1, 'Callback should have not been invoked since it has been deregistered.');
});

test('should handle function calls', async t => {
	const responsePromise = t.context.client.testFunction(1, 'secondArg');
	t.is(t.context.testBackend.sendMessage.callCount, 1);
	const functionCallMessage = t.context.testBackend.sendMessage.firstCall.args[0];
	t.is(functionCallMessage.type, 'FUNCTION_CALL');
	t.is(functionCallMessage.functionName, 'testFunction');
	t.deepEqual(functionCallMessage.args[0], { type: 'number', value: 1});
	t.deepEqual(functionCallMessage.args[1], { type: 'string', value: 'secondArg'});
	// One listener for the callbacks, and one for specifically listening to the response of the function call
	t.is(t.context.testBackend.onResponse.callCount, 2);
	const functionCallResponseListener = t.context.testBackend.onResponse.secondCall.args[0];
	// Emulate response message with the result
	functionCallResponseListener({type: 'RETURN_VALUE', id: functionCallMessage.id, value: 'return value'});
	t.is(t.context.testBackend.removeResponseListener.callCount, 1);
	t.is(t.context.testBackend.removeResponseListener.firstCall.args[0], functionCallResponseListener);
	const returnValue = await responsePromise;
	t.is(returnValue, 'return value');
});

test('should handle function call errors', async t => {
	const responsePromise = t.context.client.testFunction(1, 'secondArg');
	const functionCallMessage = t.context.testBackend.sendMessage.firstCall.args[0];
	// One listener for the callbacks, and one for specifically listening to the response of the function call
	t.is(t.context.testBackend.onResponse.callCount, 2);
	const functionCallResponseListener = t.context.testBackend.onResponse.secondCall.args[0];
	// Emulate error
	functionCallResponseListener({type: 'ERROR', id: functionCallMessage.id, error: 'error message'});
	t.is(t.context.testBackend.removeResponseListener.callCount, 1);
	t.is(t.context.testBackend.removeResponseListener.firstCall.args[0], functionCallResponseListener);
	try {
		const returnValue = await responsePromise;
	} catch (e) {
		t.is(e, 'error message');
	}
});