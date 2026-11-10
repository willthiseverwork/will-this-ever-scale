import {groupProducts} from '../../../lib/group-products-server';
export const runtime='nodejs';
export async function POST(request:Request){return groupProducts(request,false);}
