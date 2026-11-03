export const runtime='nodejs';
export async function GET(){return Response.json({paymentLinks:process.env.WTES_PAYPAL_SET_LINK_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}})}
