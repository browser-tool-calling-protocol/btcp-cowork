/**
 * BrowserFolderAccessCard - UI component for requesting and managing folder access
 *
 * Displays the current folder access status and provides buttons to:
 * - Request access to a new folder
 * - View current folder path
 * - Revoke access
 */

import { getBrowserSupportMessage, useBrowserFolderAccess } from '@renderer/hooks/useBrowserFolderAccess'
import { cn } from '@renderer/utils'
import { Button, Spin, Tooltip } from 'antd'
import { AlertTriangle, Folder, FolderOpen, X } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

export interface BrowserFolderAccessCardProps {
  className?: string
  onAccessGranted?: (folderName: string) => void
  onAccessRevoked?: () => void
}

export const BrowserFolderAccessCard: FC<BrowserFolderAccessCardProps> = ({
  className,
  onAccessGranted,
  onAccessRevoked
}) => {
  const { t } = useTranslation()
  const { state, requestAccess, revokeAccess } = useBrowserFolderAccess()

  const handleRequestAccess = async () => {
    const success = await requestAccess()
    if (success && state.folderName) {
      onAccessGranted?.(state.folderName)
    }
  }

  const handleRevokeAccess = () => {
    revokeAccess()
    onAccessRevoked?.()
  }

  // Browser not supported
  if (!state.isSupported) {
    return (
      <div className={cn('rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4', className)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-700 dark:text-yellow-400">
              {t('browser.folder_access.not_supported.title', 'Browser Not Supported')}
            </h4>
            <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-300">{getBrowserSupportMessage()}</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div className={cn('rounded-lg border border-red-500/30 bg-red-500/10 p-4', className)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <h4 className="font-medium text-red-700 dark:text-red-400">
              {t('browser.folder_access.error.title', 'Access Error')}
            </h4>
            <p className="mt-1 text-red-600 text-sm dark:text-red-300">{state.error}</p>
            <Button type="primary" size="small" className="mt-3" onClick={handleRequestAccess}>
              {t('browser.folder_access.retry', 'Try Again')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (state.isLoading) {
    return (
      <div className={cn('flex items-center justify-center gap-3 rounded-lg border p-4', className)}>
        <Spin size="small" />
        <span className="text-[var(--color-text-2)] text-sm">
          {t('browser.folder_access.loading', 'Waiting for folder selection...')}
        </span>
      </div>
    )
  }

  // Has access - show current folder
  if (state.hasAccess && state.folderName) {
    return (
      <div className={cn('rounded-lg border border-green-500/30 bg-green-500/10 p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <h4 className="font-medium text-green-700 dark:text-green-400">
                {t('browser.folder_access.granted.title', 'Folder Access Granted')}
              </h4>
              <p className="text-green-600 text-sm dark:text-green-300">{state.folderName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Tooltip title={t('browser.folder_access.change', 'Change Folder')}>
              <Button size="small" onClick={handleRequestAccess} icon={<Folder size={14} />}>
                {t('browser.folder_access.change_short', 'Change')}
              </Button>
            </Tooltip>
            <Tooltip title={t('browser.folder_access.revoke', 'Revoke Access')}>
              <Button size="small" danger onClick={handleRevokeAccess} icon={<X size={14} />} />
            </Tooltip>
          </div>
        </div>
      </div>
    )
  }

  // No access - show request button
  return (
    <div
      className={cn('rounded-lg border border-[var(--color-border)] bg-[var(--color-background-soft)] p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5 text-[var(--color-text-2)]" />
          <div>
            <h4 className="font-medium text-[var(--color-text)]">
              {t('browser.folder_access.request.title', 'Folder Access Required')}
            </h4>
            <p className="text-[var(--color-text-2)] text-sm">
              {t(
                'browser.folder_access.request.description',
                'Grant access to a folder for the agent to manage files.'
              )}
            </p>
          </div>
        </div>
        <Button type="primary" onClick={handleRequestAccess}>
          {t('browser.folder_access.select', 'Select Folder')}
        </Button>
      </div>
    </div>
  )
}

export default BrowserFolderAccessCard
