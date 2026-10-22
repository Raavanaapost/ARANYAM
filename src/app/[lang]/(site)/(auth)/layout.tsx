export default function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  return <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:py-14">{children}</div>;
}
