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
    // open login in new tab
    window.open("/login", "_blank");
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  
  return (
    <nav className="relative w-full bg-[#1A1A1A] border-b border-gray-800 z-50">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        
        {/* LEFT: Logo & Mobile Toggle */}
        <div className="flex items-center gap-4">
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

        {/* CENTER: Navigation Links */}
        <div className="hidden md:flex gap-4 lg:gap-6 xl:gap-8 text-gray-400 text-sm font-medium items-center">
          <NavContent session={session} />
        </div>

        {/* RIGHT: Auth Section */}
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

      {/* MOBILE DROPDOWN */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-[#1A1A1A] border-b border-gray-800 flex flex-col p-6 gap-6 md:hidden animate-in slide-in-from-top-2 duration-200">
          <NavContent session={session} onLinkClick={() => setIsMenuOpen(false)} />
        </div>
      )}
    </nav>
  );
};

const NavContent = ({ session, onLinkClick }: { session: any, onLinkClick?: () => void }) => (
  <>
    <Link href="/"  onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">
      Home
    </Link>

    <Link href="/demo" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">
      Demo
    </Link>

    <Link href="/dashboard"  onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">
      Forensic Dashboard
    </Link>

    <Link href="/network" target="_blank" rel="noopener noreferrer" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">
      Network
    </Link>

    <Link href="/stats" target="_blank" rel="noopener noreferrer" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">
      Stats
    </Link>

    <Link href="/service" onClick={onLinkClick} className="hover:text-[#CAFF33] transition-colors">
      Request Service
    </Link>
    
    {session?.user?.role === "admin" && (
      <Link 
        href="/admin"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onLinkClick}
        className="hover:text-[#CAFF33] transition-colors underline underline-offset-4 decoration-1"
      >
        Admin Dashboard
      </Link>
    )}
  </>
);

export default Navbar;