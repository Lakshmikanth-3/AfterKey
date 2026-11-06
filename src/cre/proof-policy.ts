type CaseConfig={repository:string;approver:string};
type ProofConfig={owner:string;subject:string;github?:CaseConfig};

const eq=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();

/** Strict semantic checks for the hackathon's primary departure evidence. */
export function departureProofChecks(output:any,config:ProofConfig){
  const before=output?.before,after=output?.after,departure=output?.departureCase;
  return {
    departureTrigger:output?.trigger==='http:departure',
    departureCaseValid:!!config.github&&departure?.repository===config.github.repository&&departure?.approvedBy===config.github.approver&&eq(departure?.subject,config.subject)&&Number.isSafeInteger(departure?.issueNumber)&&departure.issueNumber>0,
    baselinePresent:typeof before?.block==='string'&&/^\d+$/.test(before.block)&&BigInt(before.block)>0n,
    beforeAccessPresent:Array.isArray(before?.findings)&&before.findings.length>0,
    afterAccessAbsent:Array.isArray(after?.findings)&&after.findings.length===0&&after?.complete===true,
    preservationPassed:output?.preservation?.checked===true&&output?.preservation?.passed===true&&Array.isArray(output?.preservation?.changes)&&output.preservation.changes.length===0,
    positionCoverage:before?.uniswapIncluded===true&&after?.uniswapIncluded===true&&Array.isArray(before?.positions)&&Array.isArray(after?.positions)&&before.positions.length>0&&before.positions.length===after.positions.length,
    permissionStateVerified:output?.permissionStateVerified===true,
    finalStatus:output?.status==='permissions_absent_assets_preserved',
    walletPairMatches:eq(before?.owner,config.owner)&&eq(after?.owner,config.owner)&&eq(before?.subject,config.subject)&&eq(after?.subject,config.subject)
  };
}
