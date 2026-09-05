/**
 * AppShell — header + page + footer + mobile tab bar, the frame every consumer
 * page renders inside. Server component; pages pass the username they already
 * loaded. `footer={false}` for full-height panes (messages).
 */
import SiteHeader from './site-header'
import SiteFooter from './site-footer'
import MobileTabBar from './mobile-tabbar'

interface Props {
  username: string
  displayName?: string
  children: React.ReactNode
  searchValue?: string
  footer?: boolean
  footerActive?: string
  tabbar?: boolean
}

export default function AppShell({ username, displayName, children, searchValue, footer = true, footerActive, tabbar = true }: Props) {
  return (
    <div className={`app-shell${tabbar ? ' has-tabbar' : ''}`}>
      <SiteHeader username={username} displayName={displayName} searchValue={searchValue} />
      {children}
      {footer && <SiteFooter active={footerActive} />}
      {tabbar && <MobileTabBar username={username} />}
    </div>
  )
}
