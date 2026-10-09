import { describe,it,expect } from 'vitest';
import { diagnosticRecord } from './diagnostics';
describe('safe browser diagnostics',()=>{
  it('does not serialize private error text, context objects or URLs',()=>{
    const error=new Error('private-token private-photo');
    error.stack='Error private-token\n at https://app.test/src/app/App.tsx:12:4\n at https://storage.test/image?token=private-token';
    const record=diagnosticRecord('download_failed',error,{generation_id:'11111111-1111-4111-8111-111111111111',token:'private-token',body:'private-photo',url:'https://secret.test',request_id:'https://secret.test',code:'https://secret.test'});
    expect(record.location).toBe('/src/app/App.tsx:12:4');
    expect(JSON.stringify(record)).not.toContain('private-token');expect(JSON.stringify(record)).not.toContain('private-photo');expect(JSON.stringify(record)).not.toContain('https://');
  });
});
