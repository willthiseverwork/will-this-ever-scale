import {workspaceInput,type Workspace} from './workspace-types';
/** Export only the stored workspace, not provider identity, credentials or raw transactions. */
export function serializeWorkspaceExport(workspace:Workspace,uploads:unknown[]=[]){
 const data=workspaceInput.parse({revision:workspace.revision,settings:workspace.settings,snapshots:workspace.snapshots,reminders:workspace.reminders,tests:workspace.tests,...(workspace.profile?{profile:workspace.profile}:{})});
 return JSON.stringify({format:'will-this-ever-scale-workspace',version:1,workspace:{...data,trialStartedAt:workspace.trialStartedAt,trialEndsAt:workspace.trialEndsAt},uploads},null,2);
}
