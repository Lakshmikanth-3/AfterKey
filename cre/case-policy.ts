// Pure validation shared by the external-case workflow and unit tests.
export type GitHubCasePolicy={repository:string;approver:string;issueNumber?:number};
export type DepartureCase={repository:string;issueNumber:number;url:string;updatedAt:string;approvedAt:string;subject:string;approvedBy:string};
export function validateCasePolicy(p:GitHubCasePolicy){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.repository)||!/^([A-Za-z0-9-]{1,39})$/.test(p.approver))throw new Error('Configure an exact GitHub repository and approving username.');
  if(p.issueNumber!==undefined&&(!Number.isSafeInteger(p.issueNumber)||p.issueNumber<1))throw new Error('GitHub issue number must be positive.');
}
export function verifyDepartureCase(data:any,policy:GitHubCasePolicy,issueNumber:number,subject:string):DepartureCase{
  validateCasePolicy(policy);
  if(!Number.isSafeInteger(issueNumber)||issueNumber<1)throw new Error('A positive GitHub departure issue number is required.');
  if(data?.pull_request||data?.number!==issueNumber||data?.state!=='closed'||data?.state_reason!=='completed')throw new Error('Departure issue must be closed as completed. Pull requests and cancelled issues are not departure cases.');
  const expectedUrl=`https://github.com/${policy.repository}/issues/${issueNumber}`;
  if(String(data.html_url).toLowerCase()!==expectedUrl.toLowerCase())throw new Error('Departure issue repository mismatch.');
  if(String(data.closed_by?.login).toLowerCase()!==policy.approver.toLowerCase())throw new Error('Departure case was not completed by the configured approver.');
  if(!data.labels?.some((l:any)=>l?.name==='afterkey-departure'))throw new Error('Missing afterkey-departure issue label.');
  const matches=String(data.body||'').match(/^AfterKey-Subject:\s*(0x[0-9a-fA-F]{40})\s*$/gm)||[];
  if(matches.length!==1||matches[0].replace(/^AfterKey-Subject:\s*/,'').trim().toLowerCase()!==subject.toLowerCase())throw new Error('Departure issue must contain exactly one matching AfterKey-Subject line.');
  const updated=Date.parse(data.updated_at),closed=Date.parse(data.closed_at);
  if(typeof data.updated_at!=='string'||typeof data.closed_at!=='string'||!Number.isFinite(updated)||!Number.isFinite(closed))throw new Error('Departure issue has invalid update/approval timestamps.');
  if(updated>closed)throw new Error('Departure issue changed after approval. The configured approver must reopen, review and close it as completed again.');
  return {repository:policy.repository,issueNumber,url:expectedUrl,updatedAt:data.updated_at,approvedAt:data.closed_at,subject,approvedBy:data.closed_by.login};
}
