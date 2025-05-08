import {Metadata} from "next";
import {HomeClient} from "../components/home-client";
import "../styles/main.css";

export const metadata: Metadata = {
  title: 'SacTech Community',
  description: 'Join SacTech - The Sacramento technology community',
}

export default function Home() {
  return <HomeClient />
}
