import {workspaceInput,type Workspace} from './workspace-types';
import {businessStateSchema,type BusinessState} from './business-state';
/** Export only the stored workspace, not provider identity, credentials or raw transactions. */
export function serializeWorkspaceExport(workspace:Workspace,uploads:unknown[]=[],business?:BusinessState){
 const data=workspaceInput.parse({revision:workspace.revision,settings:workspace.settings,snapshots:workspace.snapshots,reminders:workspace.reminders,tests:workspace.tests,...(workspace.profile?{profile:workspace.profile}:{})});
 return JSON.stringify({format:'will-this-ever-scale-workspace',version:business?2:1,workspace:{...data,trialStartedAt:workspace.trialStartedAt,trialEndsAt:workspace.trialEndsAt},uploads,...(business?{business:businessStateSchema.parse(business)}:{})},null,2);
}
