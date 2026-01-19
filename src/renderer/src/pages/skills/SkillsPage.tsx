/**
 * Skills Page
 *
 * Main page for managing skills - simple text prompts that teach the agent how to perform tasks.
 * Replaces the complex KnowledgePage with RAG/vector storage.
 */
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { DraggableList } from '@renderer/components/DraggableList'
import { DeleteIcon, EditIcon } from '@renderer/components/Icons'
import ListItem from '@renderer/components/ListItem'
import PromptPopup from '@renderer/components/Popups/PromptPopup'
import Scrollbar from '@renderer/components/Scrollbar'
import { useSkills } from '@renderer/hooks/useSkill'
import type { Skill } from '@renderer/types/skill'
import type { MenuProps } from 'antd'
import { Dropdown, Empty } from 'antd'
import { Plus, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AddSkillPopup from './components/AddSkillPopup'
import SkillContent from './SkillContent'

const SkillsPage: FC = () => {
  const { t } = useTranslation()
  const { skills, update, remove, reorder } = useSkills()
  const [selectedSkill, setSelectedSkill] = useState<Skill | undefined>(skills[0])
  const [isDragging, setIsDragging] = useState(false)

  const handleAddSkill = useCallback(async () => {
    const newSkill = await AddSkillPopup.show({ title: t('skill.add') })
    if (newSkill) {
      setSelectedSkill(newSkill)
    }
  }, [t])

  useEffect(() => {
    const hasSelectedSkill = skills.find((skill) => skill.id === selectedSkill?.id)
    if (!hasSelectedSkill) {
      setSelectedSkill(skills[0])
    }
  }, [skills, selectedSkill])

  const getMenuItems = useCallback(
    (skill: Skill) => {
      const menus: MenuProps['items'] = [
        {
          label: t('skill.rename'),
          key: 'rename',
          icon: <EditIcon size={14} />,
          async onClick() {
            const name = await PromptPopup.show({
              title: t('skill.rename'),
              message: '',
              defaultValue: skill.name || ''
            })
            if (name && skill.name !== name) {
              update({ ...skill, name })
            }
          }
        },
        { type: 'divider' },
        {
          label: t('common.delete'),
          danger: true,
          key: 'delete',
          icon: <DeleteIcon size={14} className="lucide-custom" />,
          onClick: () => {
            window.modal.confirm({
              title: t('skill.delete_confirm'),
              centered: true,
              onOk: () => {
                setSelectedSkill(undefined)
                remove(skill.id)
              }
            })
          }
        }
      ]

      return menus
    },
    [remove, update, t]
  )

  return (
    <Container>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('skill.title')}</NavbarCenter>
      </Navbar>
      <ContentContainer id="content-container">
        <SkillsSideNav>
          <DraggableList
            list={skills}
            onUpdate={reorder}
            style={{ marginBottom: 0, paddingBottom: isDragging ? 50 : 0 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}>
            {(skill: Skill) => (
              <Dropdown menu={{ items: getMenuItems(skill) }} trigger={['contextMenu']} key={skill.id}>
                <div>
                  <ListItem
                    active={selectedSkill?.id === skill.id}
                    icon={<Sparkles size={16} />}
                    title={skill.name}
                    onClick={() => setSelectedSkill(skill)}
                  />
                </div>
              </Dropdown>
            )}
          </DraggableList>
          {!isDragging && (
            <AddSkillItem onClick={handleAddSkill}>
              <AddSkillName>
                <Plus size={18} />
                {t('button.add')}
              </AddSkillName>
            </AddSkillItem>
          )}
          <div style={{ minHeight: '10px' }}></div>
        </SkillsSideNav>
        {skills.length === 0 ? (
          <MainContent>
            <Empty description={t('skill.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </MainContent>
        ) : selectedSkill ? (
          <SkillContent skill={selectedSkill} onUpdate={update} />
        ) : null}
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  min-height: 100%;
`

const MainContent = styled(Scrollbar)`
  padding: 15px 20px;
  display: flex;
  width: 100%;
  flex-direction: column;
  padding-bottom: 50px;
`

const SkillsSideNav = styled(Scrollbar)`
  display: flex;
  flex-direction: column;

  width: calc(var(--settings-width) + 100px);
  border-right: 0.5px solid var(--color-border);
  padding: 12px 10px;

  .ant-menu {
    border-inline-end: none !important;
    background: transparent;
    flex: 1;
  }

  .ant-menu-item {
    height: 40px;
    line-height: 40px;
    margin: 4px 0;
    width: 100%;

    &:hover {
      background-color: var(--color-background-soft);
    }

    &.ant-menu-item-selected {
      background-color: var(--color-background-soft);
      color: var(--color-primary);
    }
  }

  > div {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }
`

const AddSkillItem = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 7px 12px;
  position: relative;
  border-radius: var(--list-item-border-radius);
  border: 0.5px solid transparent;
  cursor: pointer;
  &:hover {
    background-color: var(--color-background-soft);
  }
`

const AddSkillName = styled.div`
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`

export default SkillsPage
