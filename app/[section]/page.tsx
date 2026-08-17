import SectionClient from './SectionClient';import {currentUser,can} from '@/lib/auth';import {notFound,redirect} from 'next/navigation';
export default async function Section({params}:{params:Promise<{section:string}>}){const {section}=await params;const u=await currentUser();if(!u)redirect('/login');if(!can(u.role,section))notFound();return <SectionClient section={section}/>}
