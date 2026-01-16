import * as React from 'react'
import { CharacterCounter, CharacterCounterText, WarningIcon, ErrorText } from './CharacterCounter.styled'
import { CharacterCounterProps } from './CharacterCounter.types'

const CharacterCounterComponent = React.memo<CharacterCounterProps>(props => {
  const { characterCount, maxCharacters, hasError } = props

  return (
    <CharacterCounter>
      <CharacterCounterText isError={hasError}>
        {characterCount}/{maxCharacters}
      </CharacterCounterText>
      {hasError && <WarningIcon />}
      {hasError && <ErrorText>Character Limit Reached</ErrorText>}
    </CharacterCounter>
  )
})

export { CharacterCounterComponent }
