import BusinessNumbers from '../../components/business-numbers';import '../workspace.css';import './numbers.css';
export const metadata={title:'Your business numbers | Will This Ever Scale',description:'Explore the sales and costs supported by your records.',alternates:{canonical:'/business-numbers'},robots:{index:false,follow:false}};
export default function Page(){return <BusinessNumbers/>}
