import SectionClient from './SectionClient';

export default async function Section({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  return <SectionClient section={section}/>;
}
