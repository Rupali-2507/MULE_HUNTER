"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react"; 
import LogoutButton from "./LogoutButton";
import Link from "next/link";
import { Menu, X } from "lucide-react"; 

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleLoginClick = () => {
    router.push("/login");
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  
  return (
    <nav className="relative w-full bg-[#1A1A1A] border-b border-gray-800 z-50">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        
        {/* LEFT: Logo & Mobile Toggle */}
        <div className="flex items-center gap-4">
          {/* Hamburger Button (Visible only on mobile) */}
          <button 
            className="md:hidden text-gray-400 hover:text-[#CAFF33] transition-colors"
            onClick={toggleMenu}
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          <div className="flex items-center shrink-0">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={130}
              height={35}
              className="object-contain" 
              priority
            />
          </div>
        </div>

        {/* CENTER: Navigation Links (Hidden on mobile, flex on desktop) */}
        <div className="hidden md:flex gap-8 text-gray-400 text-sm font-medium items-center">
          <NavContent session={session} />
        </div>

        {/* RIGHT: Auth Section (Always visible) */}
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
      </div>

      {/* MOBILE DROPDOWN (Visible only when isMenuOpen is true) */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-[#1A1A1A] border-b border-gray-800 flex flex-col p-6 gap-6 md:hidden animate-in slide-in-from-top-2 duration-200">
          <NavContent session={session} onLinkClick={() => setIsMenuOpen(false)} />
        </div>
      )}
    </nav>
  );
};

// Extracted Nav Links to avoid repetition
const NavContent = ({ session, onLinkClick }: { session: any, onLinkClick?: () => void }) => (
  <>
    <Link href="/" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">Home</Link>
    <a 
      href="https://mule-hunter.vercel.app/" 
      target="_blank" 
      rel="noopener noreferrer" 
      onClick={onLinkClick}
      className="hover:text-[#CAFF33] transition-colors cursor-pointer"
    >
      Network
    </a>
    <Link href="/stats" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">Stats</Link>
    <Link href="/service" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">Request Service</Link>
    <Link href="/transaction" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">Transaction</Link>
    
    {session?.user?.role === "admin" && (
      <Link 
        href="/admin" 
        onClick={onLinkClick}
        className="hover:text-[#CAFF33] transition-colors underline underline-offset-4 decoration-1"
      >
        Admin Dashboard
      </Link>
    )}
  </>
);

export default Navbar;