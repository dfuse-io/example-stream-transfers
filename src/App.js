import React, { Component } from 'react';
import { createEoswsSocket, EoswsClient, InboundMessageType } from '@dfuse/eosws-js';

import './App.css';

const apiToken = process.env.REACT_APP_DFUSE_API_TOKEN
const wsUrl = `wss://mainnet.eos.dfuse.io/v1/stream?token=${apiToken}`

class App extends Component {
  state = {
    connected: false,
    errorMessages: [],
    transfers: []
  }

  constructor() {
    super()

    this.stream = undefined
    this.client = new EoswsClient(createEoswsSocket(() => new WebSocket(wsUrl), {
      onClose: this.onClose,
      onError: this.onError,
      onReconnect: this.onReconnect,
    }))
  }

  componentWillUnmount() {
    if (this.stream !== undefined) {
      this.stream.unlisten()
    }

    // Try our best to disconnect gracefully
    this.client.disconnect()
  }

  launch = async () => {
    if (!apiToken) {
      const messages = [
        "To correctly run this sample, you need to defined an environment variable",
        "named 'REACT_APP_DFUSE_API_TOKEN' with the value being your dfuse API token.",
        "",
        "To make it into effect, define the variable before starting the development",
        "scripts, something like:",
        "",
        "REACT_APP_DFUSE_API_TOKEN=ey....af yarn start",
        "",
        "You can obtain a free API token by visiting https://dfuse.io"
      ]

      this.setState({ connected: false, errorMessages: messages, transfers: [] })
      return
    }

    this.setState({ errorMessages: [], transfers: [] })

    try {
      await this.client.connect()
      this.setState({ connected: true })

      this.streamTransfer()
    } catch (error) {
      this.setState({ errorMessages: ["Unable to connect to socket.", JSON.stringify(error)] })
    }
  }

  streamTransfer = () => {
    this.stream = this.client.getActionTraces({ account: "eosio.token", action_name: "transfer" })
    this.stream.onMessage(this.onMessage)
  }

  onMessage = async (message) => {
    if (message.type !== InboundMessageType.ACTION_TRACE) {
      return
    }

    const { from, to, quantity, memo } = message.data.trace.act.data
    const transfer = `Transfer [${from} -> ${to}, ${quantity}] (${memo})`

    this.setState((prevState) => ({
      transfers: [ ...prevState.transfers.slice(-100), transfer ],
    }))
  }

  stop = async () => {
    if (this.stream === undefined) {
      return
    }

    this.stream.unlisten()
    this.stream = undefined

    try {
      await this.client.disconnect()
    } catch (error) {
      this.setState({ errorMessages: ["Unable to disconnect socket correctly.", JSON.stringify(error)]})
    }
  }

  onClose = () => {
    this.setState({ connected: false })
  }

  onError = (error) => {
    this.setState({ errorMessages: ["An error occurred with the socket.", JSON.stringify(error)]})
  }

  onReconnect = () => {
    this.setState({ connected: true })
    this.streamTransfer()
  }

  renderTransfer = (transfer, index) => {
    return <code key={index} className="App-transfer">{transfer}</code>
  }

  renderTransfers() {
    return (
      <div className="App-infinite-container">
        { this.state.transfers.length <= 0
            ? this.renderTransfer("Nothing yet, start by hitting Launch!")
            : this.state.transfers.reverse().map(this.renderTransfer)
        }
      </div>
    )
  }

  renderError = (error, index) => {
    if (error === "") {
      return <br key={index} className="App-error"/>
    }

    return <code key={index} className="App-error">{error}</code>
  }

  renderErrors() {
    if (this.state.errorMessages.length <= 0) {
      return null
    }

    return (
      <div className="App-container">
        {this.state.errorMessages.map(this.renderError)}
      </div>
    )
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h2>Stream Transfers</h2>
          {this.renderErrors()}
          <div className="App-buttons">
            <button className="App-button" onClick={this.launch}>Launch</button>
            <button className="App-button" onClick={this.stop}>Stop</button>
          </div>
          <main className="App-main">
            <p className="App-status">
              {`Connected: ${this.state.connected ? "Connected (Showing last 100 transfers)" : "Disconnected"}`}
            </p>
            {this.renderTransfers()}
          </main>
        </header>
      </div>
    );
  }
}

export default App;
