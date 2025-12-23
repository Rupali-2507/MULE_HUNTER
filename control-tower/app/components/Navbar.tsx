"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react"; 
import LogoutButton from "./LogoutButton";
import Link from "next/link"; // Recommended over <a> for internal links

const Navbar = () => {
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleLoginClick = () => {
    router.push("/login");
  };
  
  return (
    <nav className="w-full flex items-center justify-between px-4 md:px-8 py-4 bg-[#1A1A1A] border-b border-gray-800">
      
      {/* Logo */}
      <div className="flex items-center shrink-0">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={150}
          height={40}
          className="object-contain" 
          priority
        />
      </div>

      {/* Navigation Links */}
      <div className="hidden md:flex gap-8 text-gray-400 text-sm font-medium items-center">
        <Link href="/" className="hover:text-[#CAFF33] transition-colors">Home</Link>


        <a 
          href="https://fraud-viz-latest.onrender.com/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:text-[#CAFF33] transition-colors cursor-pointer"
        >
          Network
        </a>
        <a href="/stats" className="hover:text-[#CAFF33] transition-colors">Stats</a>
        <a href="/transaction" className="hover:text-[#CAFF33] transition-colors">Transactions</a>
        <a href="/service" className="hover:text-[#CAFF33] transition-colors">Request Service</a>
        {/* DASHBOARD - Only visible to Admins */}
        {session?.user?.role === "admin" && (
          <Link href="/admin" className="hover:text-[#CAFF33] transition-colors underline underline-offset-4 decoration-1">
            Admin Dashboard
          </Link>
        )}
      </div>

      {/* Auth Section */}
      <div className="flex items-center">
        {status === "loading" ? (
          <div className="h-8 w-20 bg-gray-800 animate-pulse rounded-full" />
        ) : session ? (
          <div className="flex items-center gap-4">
            <span className="hidden lg:block text-xs text-gray-500 font-mono uppercase tracking-tighter">
              {session.user?.name}
            </span>
            <LogoutButton />
          </div>
        ) : (
          <button 
            onClick={handleLoginClick} 
            className="bg-[#CAFF33] px-6 py-2 rounded-full text-black font-bold text-sm hover:bg-[#b8e62e] transition-all cursor-pointer"
          >
            Login
          </button>
        )}
      </div>

    </nav>
  );
};

export default Navbar;