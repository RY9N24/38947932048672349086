import Application from "../../components/application";
export const dynamic="force-dynamic";
export default function Page(){return <Application displayTZ={process.env.DISPLAY_TZ||'Europe/Samara'} />;}
