import { HTTPClient, consensusIdenticalAggregation, type Runtime } from '@chainlink/cre-sdk';
import { verifyDepartureCase, type GitHubCasePolicy, type DepartureCase } from './case-policy';

export function readDepartureCase<C>(runtime:Runtime<C>,policy:GitHubCasePolicy,issueNumber:number,subject:string){
  // Fixed GitHub API origin and configured repository. No user-supplied fetch URL or credentials.
  return new HTTPClient().sendRequest(runtime,requester=>{
    // CRE owns transport headers such as User-Agent; setting one is rejected by the DON.
    const response=requester.sendRequest({url:`https://api.github.com/repos/${policy.repository}/issues/${issueNumber}`,method:'GET',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},cacheSettings:{store:false,maxAge:'0s'}}).result();
    if(response.statusCode!==200)throw new Error(`GitHub case read failed (${response.statusCode}). Use a public repository with a readable departure issue.`);
    if(response.body.length>100000)throw new Error('GitHub departure issue exceeds the size limit.');
    const data=JSON.parse(new TextDecoder().decode(response.body));
    // Consensus is over the validated business fields, not variable headers or unrelated metadata.
    return verifyDepartureCase(data,policy,issueNumber,subject);
  },consensusIdenticalAggregation<DepartureCase>())().result();
}
