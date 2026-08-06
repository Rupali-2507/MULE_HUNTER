import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "../components/Navbar";
import AdminPanel from "../components/AdminPanel";

export default async function AdminPage() {
  const session = await auth();

  if (!session || (session.user as any).role !== "admin") {
    redirect("/login");
  }

  await dbConnect();
  const realUsers = await User.find({}).lean();

  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#141414] text-white">
      <Navbar/>
      <AdminPanel initialUsers={JSON.parse(JSON.stringify(realUsers))}  session={session}/>
      <footer className="bg-[#1A1A1A] py-4 border-t border-gray-800 text-center text-gray-500 text-[10px]">
        alertixAI ADMINISTRATIVE CONTROL PANEL v1.0
      </footer>
    </main>
  );
}