import { useStore } from '@nanostores/react';
import { memo, useMemo, type ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as Tabs from '@radix-ui/react-tabs';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from '~/lib/stores/files';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile, isMobileDevice } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE, TerminalTabs } from './terminal/TerminalTabs';
import { workbenchStore } from '~/lib/stores/workbench';
import { Search } from './Search';
import { classNames } from '~/utils/classNames';
import { LockManager } from './LockManager';
import { MobileFileTreeDrawer } from '~/components/mobile/MobileFileTreeDrawer';
import { MobileTerminalDrawer } from '~/components/mobile/MobileTerminalDrawer';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    fileHistory,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);

    // The 12px desktop default is uncomfortably small to read/edit on a phone screen.
    const resolvedEditorSettings = useMemo<EditorSettings>(
      () => (isMobileDevice() ? { ...editorSettings, fontSize: '15px', gutterFontSize: '13px' } : editorSettings),
      [],
    );

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      if (!editorDocument || !unsavedFiles) {
        return false;
      }

      return unsavedFiles instanceof Set && unsavedFiles.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    // Shared file tree content (used by both desktop Panel and mobile drawer)
    const renderFileTree = (): ReactNode => (
      <Tabs.Root defaultValue="files" className="flex flex-col h-full">
        <PanelHeader className="w-full text-sm font-medium text-bolt-elements-textSecondary px-1">
          <div className="h-full flex-shrink-0 flex items-center justify-between w-full">
            <Tabs.List className="h-full flex-shrink-0 flex items-center">
              <Tabs.Trigger
                value="files"
                className={classNames(
                  'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                )}
              >
                Files
              </Tabs.Trigger>
              <Tabs.Trigger
                value="search"
                className={classNames(
                  'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                )}
              >
                Search
              </Tabs.Trigger>
              <Tabs.Trigger
                value="locks"
                className={classNames(
                  'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                )}
              >
                Locks
              </Tabs.Trigger>
            </Tabs.List>
          </div>
        </PanelHeader>

        <Tabs.Content value="files" className="flex-grow overflow-auto focus-visible:outline-none">
          <FileTree
            className="h-full"
            files={files}
            hideRoot
            unsavedFiles={unsavedFiles}
            fileHistory={fileHistory}
            rootFolder={WORK_DIR}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        </Tabs.Content>

        <Tabs.Content value="search" className="flex-grow overflow-auto focus-visible:outline-none">
          <Search />
        </Tabs.Content>

        <Tabs.Content value="locks" className="flex-grow overflow-auto focus-visible:outline-none">
          <LockManager />
        </Tabs.Content>
      </Tabs.Root>
    );

    // Shared editor content (used by both desktop Panel and mobile layout)
    const renderEditor = (): ReactNode => (
      <>
        <PanelHeader className="overflow-x-auto">
          {activeFileSegments?.length && (
            <div className="flex items-center flex-1 text-sm">
              <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
              {activeFileUnsaved && (
                <div className="flex gap-1 ml-auto -mr-1.5">
                  <PanelHeaderButton onClick={onFileSave}>
                    <div className="i-ph:floppy-disk-duotone" />
                    Save
                  </PanelHeaderButton>
                  <PanelHeaderButton onClick={onFileReset}>
                    <div className="i-ph:clock-counter-clockwise-duotone" />
                    Reset
                  </PanelHeaderButton>
                </div>
              )}
            </div>
          )}
        </PanelHeader>
        <div className="h-full flex-1 overflow-hidden modern-scrollbar">
          <CodeMirrorEditor
            theme={theme}
            editable={!isStreaming && editorDocument !== undefined}
            settings={resolvedEditorSettings}
            doc={editorDocument}
            autoFocusOnDocumentChange={!isMobile()}
            onScroll={onEditorScroll}
            onChange={onEditorChange}
            onSave={onFileSave}
          />
        </div>
      </>
    );

    /*
     * Mobile layout: file tree in a slide-out drawer, editor as main content,
     * terminal in a bottom sheet. No PanelGroup — touch-friendly stacked layout.
     */
    if (isMobileDevice()) {
      return (
        <div className="flex flex-col h-full w-full">
          {/* Compact toolbar: file tree toggle + breadcrumb + save actions */}
          <div className="flex items-center gap-2 px-2 py-1 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 min-h-[44px]">
            <MobileFileTreeDrawer>{renderFileTree()}</MobileFileTreeDrawer>
            <div className="flex-1 overflow-x-auto">
              {activeFileSegments?.length && (
                <div className="flex items-center text-xs">
                  <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                </div>
              )}
            </div>
            {activeFileUnsaved && (
              <div className="flex gap-1">
                <PanelHeaderButton onClick={onFileSave}>
                  <div className="i-ph:floppy-disk-duotone" />
                </PanelHeaderButton>
                <PanelHeaderButton onClick={onFileReset}>
                  <div className="i-ph:clock-counter-clockwise-duotone" />
                </PanelHeaderButton>
              </div>
            )}
          </div>
          {/* Editor fills remaining space */}
          <div className="flex-1 overflow-hidden">{renderEditor()}</div>
          {/* Terminal as bottom sheet (only if enabled) */}
          {showTerminal && (
            <MobileTerminalDrawer>
              {/* TerminalTabs' root element is itself a react-resizable-panels Panel (see
                  the desktop layout below, which uses it the same way), which throws if it
                  isn't rendered inside a PanelGroup -- the bottom sheet supplies the actual
                  height, so this PanelGroup only exists to satisfy that context. */}
              <PanelGroup direction="vertical" className="h-full">
                <TerminalTabs />
              </PanelGroup>
            </MobileTerminalDrawer>
          )}
        </div>
      );
    }

    /*
     * Desktop layout: resizable PanelGroup with file tree sidebar, editor, and terminal.
     * This preserves the original upstream desktop layout — unchanged.
     */
    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15} collapsible className="border-r border-bolt-elements-borderColor">
              <div className="h-full">{renderFileTree()}</div>
            </Panel>

            <PanelResizeHandle />
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              {renderEditor()}
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <TerminalTabs />
      </PanelGroup>
    );
  },
);
