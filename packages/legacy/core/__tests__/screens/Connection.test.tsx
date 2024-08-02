/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigation } from '@react-navigation/native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import fs from 'fs'
import path from 'path'
import React from 'react'

import { ConfigurationContext } from '../../App/contexts/configuration'
import { useOutOfBandById, useConnectionByOutOfBandId } from '../../App/hooks/connections'
import ConnectionModal from '../../App/screens/Connection'
import { testIdWithKey } from '../../App/utils/testable'
import configurationContext from '../contexts/configuration'
import timeTravel from '../helpers/timetravel'
import { TOKENS, useContainer } from '../../App/container-api'

const oobRecordPath = path.join(__dirname, '../fixtures/oob-record.json')
const oobRecord = JSON.parse(fs.readFileSync(oobRecordPath, 'utf8'))
const proofNotifPath = path.join(__dirname, '../fixtures/proof-notif.json')
const proofNotif = JSON.parse(fs.readFileSync(proofNotifPath, 'utf8'))
const offerNotifPath = path.join(__dirname, '../fixtures/offer-notif.json')
const offerNotif = JSON.parse(fs.readFileSync(offerNotifPath, 'utf8'))
const connectionPath = path.join(__dirname, '../fixtures/connection-v1.json')
const connection = JSON.parse(fs.readFileSync(connectionPath, 'utf8'))
const props = { params: { oobRecordId: connection.id } }

jest.useFakeTimers({ legacyFakeTimers: true })
jest.spyOn(global, 'setTimeout')
jest.mock('../../App/container-api')

jest.mock('../../App/container-api', () => ({
  ...jest.requireActual('../../App/container-api'),
  useContainer: jest.fn().mockReturnValue({ resolve: (a: any) => undefined })
}))

jest.mock('../../App/hooks/connections', () => ({
  useOutOfBandByConnectionId: jest.fn(),
  useConnectionByOutOfBandId: jest.fn(),
  useOutOfBandById: jest.fn(),
}))

describe('Connection Modal Component', () => {
  beforeEach(() => {

    // @ts-ignore
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [] }
        }
      }
    })
    // @ts-ignore-next-line
    // useOutOfBandByConnectionId.mockReturnValue({ outOfBandInvitation: { goalCode: 'aries.vc.verify.once' } })
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  test('Renders correctly', async () => {
    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={props as any} />
      </ConfigurationContext.Provider>
    )
    const tree = render(element)

    expect(tree).toMatchSnapshot()
  })

  test('Updates after delay', async () => {
    // @ts-ignore-next-line
    useConnectionByOutOfBandId.mockReturnValueOnce(connection)
    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={props as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    await waitFor(() => {
      timeTravel(10000)
    })

    expect(tree).toMatchSnapshot()
  })

  test('Dismiss on demand', async () => {
    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [proofNotif] }
        }
      }
    })
    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={props as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    await waitFor(() => {
      timeTravel(10000)
    })

    expect(tree).toMatchSnapshot()
  })

  test('Dismiss navigates Home', async () => {
    const navigation = useNavigation()
    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={props as any} />
      </ConfigurationContext.Provider>
    )

    const { getByTestId } = render(element)
    const dismissButton = getByTestId(testIdWithKey('BackToHome'))
    fireEvent(dismissButton, 'press')

    expect(navigation.navigate).toBeCalledTimes(1)
    expect(navigation.navigate).toBeCalledWith('Tab Home Stack', { screen: 'Home' })
  })

  test('No connection, navigation to proof', async () => {
    const threadId = 'qrf123'
    const navigation = useNavigation()
    // @ts-ignore-next-line
    useOutOfBandById.mockReturnValue({
      ...oobRecord,
      // _tags: { ...oobRecord._tags, invitationRequestsThreadIds: [threadId] },
      getTags: () => ({ ...oobRecord._tags, invitationRequestsThreadIds: [threadId] }),
    })
    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [{ ...proofNotif, threadId }] }
        }
      }
    })

    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={{ params: { oobRecordId: oobRecord.id } } as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    expect(tree).toMatchSnapshot()
    // @ts-ignore-next-line
    expect(navigation.replace).toBeCalledTimes(1)
    // @ts-ignore-next-line
    expect(navigation.replace).toBeCalledWith('Proof Request', {
      proofId: proofNotif.id,
    })
  })

  test('Connection, no goal code navigation to chat', async () => {
    const threadId = 'qrf123'
    const connectionId = 'abc123'
    const navigation = useNavigation()
    // @ts-ignore-next-line
    useOutOfBandById.mockReturnValue({
      ...oobRecord,
      // _tags: { ...oobRecord._tags, invitationRequestsThreadIds: [threadId] },
      getTags: () => ({ ...oobRecord._tags, invitationRequestsThreadIds: [threadId] }),
    })
    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [{ ...proofNotif, threadId }] }
        }
      }
    })
    // @ts-ignore-next-lin
    useConnectionByOutOfBandId.mockReturnValue({ ...connection, id: connectionId, state: 'offer-received' })

    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={{ params: { oobRecordId: oobRecord.id } } as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    expect(tree).toMatchSnapshot()
    expect(navigation.navigate).toBeCalledTimes(0)
    expect(navigation.getParent()?.dispatch).toBeCalledTimes(1)
  })

  test('Valid goal code aries.vc.issue extracted, navigation to accept offer', async () => {
    const oobRecordId = 'def456'
    const goalCode = 'aries.vc.issue'
    const threadId = 'qrf123'
    const connectionId = 'abc123'
    const navigation = useNavigation()
    // @ts-ignore-next-line
    useOutOfBandById.mockReturnValue({
      ...oobRecord,
      getTags: () => ({ ...oobRecord._tags, invitationRequestsThreadIds: [threadId] }),
      outOfBandInvitation: { ...oobRecord.outOfBandInvitation, goalCode },
    })
    // @ts-ignore-next-lin
    useConnectionByOutOfBandId.mockReturnValue({ ...connection, id: connectionId, state: 'offer-received' })

    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [{ ...offerNotif, threadId }] }
        }
      }
    })

    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={{ params: { oobRecordId } } as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    expect(tree).toMatchSnapshot()
    expect(navigation.navigate).toBeCalledTimes(0)
    // @ts-ignore-next-lin
    expect(navigation.replace).toBeCalledWith('Credential Offer', {
      credentialId: offerNotif.id,
    })
  })

  test('Valid goal code aries.vc.verify extracted, navigation to proof request', async () => {
    const oobRecordId = 'def456'
    const goalCode = 'aries.vc.verify'
    const threadId = 'qrf123'
    const connectionId = 'abc123'
    const navigation = useNavigation()
    // @ts-ignore-next-line
    useOutOfBandById.mockReturnValue({
      ...oobRecord,
      getTags: () => ({ ...oobRecord._tags, invitationRequestsThreadIds: [threadId] }),
      outOfBandInvitation: { ...oobRecord.outOfBandInvitation, goalCode },
    })
    // @ts-ignore-next-lin
    useConnectionByOutOfBandId.mockReturnValue({ ...connection, id: connectionId, state: 'offer-received' })
    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [{ ...proofNotif, threadId }] }
        }
      }
    })

    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={{ params: { oobRecordId } } as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    expect(tree).toMatchSnapshot()
    expect(navigation.navigate).toBeCalledTimes(0)
    // @ts-ignore-next-lin
    expect(navigation.replace).toBeCalledWith('Proof Request', {
      proofId: proofNotif.id,
    })
  })

  test('Valid goal code aries.vc.verify.once extracted, navigation to proof request', async () => {
    const oobRecordId = 'def456'
    const goalCode = 'aries.vc.verify.once'
    const threadId = 'qrf123'
    const connectionId = 'abc123'
    const navigation = useNavigation()
    // @ts-ignore-next-line
    useOutOfBandById.mockReturnValue({
      ...oobRecord,
      getTags: () => ({ ...oobRecord._tags, invitationRequestsThreadIds: [threadId] }),
      outOfBandInvitation: { ...oobRecord.outOfBandInvitation, goalCode },
    })
    // @ts-ignore-next-lin
    useConnectionByOutOfBandId.mockReturnValue({ ...connection, id: connectionId, state: 'offer-received' })
    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [{ ...proofNotif, threadId }] }
        }
      }
    })

    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={{ params: { oobRecordId } } as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    expect(tree).toMatchSnapshot()
    expect(navigation.navigate).toBeCalledTimes(0)
    // @ts-ignore-next-lin
    expect(navigation.replace).toBeCalledWith('Proof Request', {
      proofId: proofNotif.id,
    })
  })

  test('Invalid goal code extracted, do nothing', async () => {
    const oobRecordId = 'def456'
    const goalCode = 'aries.vc.happy-teapot'
    const threadId = 'qrf123'
    const connectionId = 'abc123'
    const navigation = useNavigation()
    // @ts-ignore-next-line
    useOutOfBandById.mockReturnValue({
      ...oobRecord,
      getTags: () => ({ ...oobRecord._tags, invitationRequestsThreadIds: [threadId] }),
      outOfBandInvitation: { ...oobRecord.outOfBandInvitation, goalCode },
    })
    // @ts-ignore-next-lin
    useConnectionByOutOfBandId.mockReturnValue({ ...connection, id: connectionId, state: 'offer-received' })
    // @ts-ignore-next-line
    useContainer.mockReturnValue({
      resolve: (a: string) => {
        if (a === TOKENS.NOTIFICATIONS) {
          return { useNotifications: () => [{ ...proofNotif, threadId, state: 'request-received' }] }
        }
      }
    })

    const element = (
      <ConfigurationContext.Provider value={configurationContext}>
        <ConnectionModal navigation={useNavigation()} route={{ params: { oobRecordId } } as any} />
      </ConfigurationContext.Provider>
    )

    const tree = render(element)

    await waitFor(() => {
      timeTravel(10000)
    })

    expect(tree).toMatchSnapshot()
    expect(navigation.navigate).toBeCalledTimes(0)
    expect(navigation.getParent()?.dispatch).toBeCalledTimes(1)
  })
})
