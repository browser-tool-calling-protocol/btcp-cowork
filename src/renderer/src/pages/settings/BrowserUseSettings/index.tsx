import ListItem from '@renderer/components/ListItem'
import Scrollbar from '@renderer/components/Scrollbar'
import { Flex } from 'antd'
import { Settings, Wrench } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import styled from 'styled-components'

import BrowserUseGeneralSettings from './BrowserUseGeneralSettings'
import BrowserUseToolsSettings from './BrowserUseToolsSettings'

const BrowserUseSettings: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const getActiveView = () => {
    const path = location.pathname
    if (path.includes('/tools')) return 'tools'
    return 'general'
  }

  const activeView = getActiveView()

  return (
    <Container>
      <MainContainer>
        <MenuList>
          <ListItem
            title={t('settings.browser_use.general.title')}
            active={activeView === 'general'}
            onClick={() => navigate('/settings/browser-use/general')}
            icon={<Settings size={18} />}
            titleStyle={{ fontWeight: 500 }}
          />
          <ListItem
            title={t('settings.browser_use.tools.title')}
            active={activeView === 'tools'}
            onClick={() => navigate('/settings/browser-use/tools')}
            icon={<Wrench size={18} />}
            titleStyle={{ fontWeight: 500 }}
          />
        </MenuList>
        <RightContainer>
          <Routes>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<BrowserUseGeneralSettings />} />
            <Route path="tools" element={<BrowserUseToolsSettings />} />
          </Routes>
        </RightContainer>
      </MainContainer>
    </Container>
  )
}

const Container = styled(Flex)`
  flex: 1;
`

const MainContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  width: 100%;
  height: calc(100vh - var(--navbar-height) - 6px);
  overflow: hidden;
`

const MenuList = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: var(--settings-width);
  padding: 12px;
  padding-bottom: 48px;
  border-right: 0.5px solid var(--color-border);
  height: calc(100vh - var(--navbar-height));
`

const RightContainer = styled.div`
  flex: 1;
  position: relative;
  display: flex;
`

export default BrowserUseSettings
