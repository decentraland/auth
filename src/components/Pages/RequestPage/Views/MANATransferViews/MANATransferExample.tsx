import { useState } from 'react'
import { MANATransferView, MANATransferCompleteView, MANATransferCanceledView } from './index'
import { MANATransferData } from '../../types'

/**
 * Example component demonstrating the MANA transfer views
 * This is for development/testing purposes only
 */
export const MANATransferExample = () => {
  const [currentView, setCurrentView] = useState<'transfer' | 'complete' | 'canceled'>('transfer')

  // Mock MANA transfer data
  const mockManaData: MANATransferData = {
    manaAmount: '100 MANA',
    toAddress: '0x1234567890abcdef1234567890abcdef12345678',
    recipientProfile: {
      avatars: [
        {
          avatar: {
            bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
            snapshots: {
              face256: 'https://peer.decentraland.org/content/contents/QmDefault',
              body: 'https://peer.decentraland.org/content/contents/QmDefault'
            },
            eyes: { color: { r: 0.23, g: 0.62, b: 0.3, a: 1 } },
            hair: { color: { r: 0.59, g: 0.37, b: 0.21, a: 1 } },
            skin: { color: { r: 0.8, g: 0.6, b: 0.46, a: 1 } },
            wearables: [],
            emotes: []
          },
          hasClaimedName: true,
          name: 'SceneCreator',
          description: 'Creator of Genesis Plaza',
          userId: '0x1234567890abcdef1234567890abcdef12345678',
          ethAddress: '0x1234567890abcdef1234567890abcdef12345678',
          version: 1,
          tutorialStep: 0,
          interests: [],
          hasConnectedWeb3: true
        }
      ]
    },
    sceneName: 'Genesis Plaza',
    sceneImageUrl: 'https://peer.decentraland.org/content/contents/QmSceneImage'
  }

  const handleApprove = async () => {
    console.log('Approve clicked')
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setCurrentView('complete')
  }

  const handleDeny = () => {
    console.log('Deny clicked')
    setCurrentView('canceled')
  }

  // Reset button for testing
  const handleReset = () => {
    setCurrentView('transfer')
  }

  return (
    <div>
      {currentView === 'transfer' && (
        <MANATransferView manaData={mockManaData} isLoading={false} onDeny={handleDeny} onApprove={handleApprove} />
      )}
      {currentView === 'complete' && <MANATransferCompleteView manaData={mockManaData} />}
      {currentView === 'canceled' && <MANATransferCanceledView manaData={mockManaData} />}

      {/* Reset button for testing - remove in production */}
      {currentView !== 'transfer' && (
        <button
          onClick={handleReset}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '10px 20px',
            background: '#ff2d55',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            zIndex: 9999
          }}
        >
          Reset View
        </button>
      )}
    </div>
  )
}

