// eslint-disable-next-line @typescript-eslint/naming-convention
import * as React from 'react'
import { useTranslation } from '@dcl/hooks'
import { CharacterCounterProps } from './CharacterCounter.types'
import { CharacterCounter, CharacterCounterText, ErrorText, WarningIcon } from './CharacterCounter.styled'

/* eslint-disable react/prop-types */
const CharacterCounterComponent = React.memo<CharacterCounterProps>(props => {
  const { characterCount, maxCharacters, hasError } = props
  const { t } = useTranslation()

  return (
    <CharacterCounter>
      <CharacterCounterText isError={hasError}>
        {characterCount}/{maxCharacters}
      </CharacterCounterText>
      {hasError && <WarningIcon />}
      {hasError && <ErrorText>{t('character_counter.limit_reached')}</ErrorText>}
    </CharacterCounter>
  )
})

export { CharacterCounterComponent }
