import {GET as resourceMetadata} from '../route';
export const dynamic='force-dynamic';
export async function GET(){return resourceMetadata();}
