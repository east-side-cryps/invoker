import React, {useEffect, useState} from "react";
import {useHistory} from "react-router-dom";
import {Contract} from "../types/Contract";
import {Manifest} from "../types/Manifest";
import {ABI} from "../types/ABI";
import axios from 'axios';
import {
    Flex,
    Spacer,
    Text,
    FormControl,
    Select,
    Input,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    FormLabel, Button, useToast
} from "@chakra-ui/react";
import {useWalletConnect} from "../context/WalletConnectContext";
import {
    DEFAULT_GAS_SCRIPTHASH,
    DEFAULT_NEO_NETWORK_MAGIC,
    DEFAULT_NEO_RPC_ADDRESS,
    DEFAULT_SC_SCRIPTHASH
} from "../constants";
import {ContractParamJson} from "@cityofzion/neon-core/lib/sc";
import {N3Helper} from "../helpers/N3Helper";
import SpinnerWithMessage from "../components/SpinnerWithMessage";
import ContractParameter from "../components/ContractParameter";
import {ContractParameterType} from "../types/ContractParameterTypes";

const formControlStyle = {
    maxWidth: "35rem", marginBottom: "1rem"
}

const formLabelStyle = {
    color: "#004e87", fontSize: "0.8rem", margin: 0
}
const inputStyle = {
    border: "solid 1px #0094ff",
    backgroundColor: "white",
    borderRadius: 0,
    height: "3.5rem",
}

interface ContractsResponse {
  items: Contract[];
  totalCount: number;
}

interface ContractResponse {
  manifest: Manifest;
}

function useStateSync(initialValue) {
   const [trait, updateTrait] = useState(initialValue);

   let current = trait;

   const get = () => current;

   const set = newValue => {
      current = newValue;
      updateTrait(newValue);
      return current;
   }

   return {
      get,
      set,
   }
}

export default function Invoke() {
    const walletConnectCtx = useWalletConnect()
    const history = useHistory()
    const toast = useToast()

    const n3Helper = new N3Helper(DEFAULT_NEO_RPC_ADDRESS, DEFAULT_NEO_NETWORK_MAGIC)

    const [recipientAddress, setRecipientAddress] = useState('')
    const [abi, setAbi] = useState<ABI | undefined>()
    const [contractFunction, setFunction] = useState('')
    const contracts = useStateSync([])
    const [loading, setLoading] = useState<string | null>('Checking WalletConnect Session')

    useEffect(() => {
        if (!walletConnectCtx?.loadingSession) {
            if (!walletConnectCtx?.session) {
                history.push('/connectToProceed')
            } else {
                setLoading(null)
            }
        }
    
        if (contracts.get().length === 0) {
            axios.get<ContractsResponse>('https://dora.coz.io/api/v1/neo3/testnet/contracts/1')
            .then((response) => {
              const totalPages = Math.ceil(response.data.totalCount / 15)
              contracts.set(response.data.items)
              console.log(`Got page 1 of contracts, retrieving ${totalPages} more pages...`)
              for (let i = 2; i <= totalPages; i++) {
                axios.get<ContractsResponse>(`https://dora.coz.io/api/v1/neo3/testnet/contracts/${i}`)
                .then((response) => {
                    console.log("Contracts length is " + contracts.get().length)
                    contracts.set(contracts.get().concat(response.data.items))
                })
                .catch((error) => { console.log(error) })
              }
            })  
            .catch((error) => {
              console.log(error)
            })
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletConnectCtx?.loadingSession, walletConnectCtx?.session])

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        if (!walletConnectCtx) return

        const txId = await invoke()
        if (!txId) return
        setLoading('Validating Result')
        const notification = (await n3Helper.getNotificationsFromTxId(txId))
            .find((n: any) => n.contract === DEFAULT_SC_SCRIPTHASH && n.eventname === 'StreamCreated')
        if (!notification) return
        const hexstring = ((notification.state.value as ContractParamJson[])[0].value as string)
        const json = atob(hexstring)
        const data = JSON.parse(json)
        if (!data) return
        setLoading(null)
        history.push(`/stream/${data.id}`)
    }

    const selectAbi = (e) => {
        axios.get<ContractResponse>('https://dora.coz.io/api/v1/neo3/testnet/contract/' + e.target.value)
        .then((response) => {
            console.log("ABI: " + JSON.stringify(response.data.manifest.abi))
            setAbi(response.data.manifest.abi)
        })
    }

    const selectFunction = (e) => {
        setFunction(e.target.value) 
    }

    const invoke = async () => {
        if (!walletConnectCtx) return null

        const [senderAddress] = walletConnectCtx.accounts[0].split("@")

        const gasScriptHash = DEFAULT_GAS_SCRIPTHASH
        const contractScriptHash = DEFAULT_SC_SCRIPTHASH

        const resp = await walletConnectCtx.rpcRequest({
            method: 'invokefunction',
            params: [gasScriptHash, 'transfer', ['', '', 0, []]],
        })

        if (resp.result.error && resp.result.error.message) {
            toast({
                title: resp.result.error.message,
                status: "error",
                duration: 10000,
                isClosable: true,
            })
            return null
        }

        return resp.result as string
    }

    return (
        <Flex as="form" onSubmit={handleSubmit} direction="column" align="center" flex="1" w="100%" px="0.5rem">
            {loading ? <><Spacer/><SpinnerWithMessage xl={true} message={loading} /><Spacer/></> : (<>
            <Text color="#004e87" fontWeight="bold" fontSize="2rem" m="2rem">Invoke N3 Smart Contract</Text>
            <FormControl style={formControlStyle} isRequired>
              <FormLabel style={formLabelStyle}>Smart Contract</FormLabel>
              <Select style={inputStyle} placeholder="Select" onChange={selectAbi}>
              { contracts.get().map((contract) => 
                <option key={contract.hash} value={contract.hash}>{contract.manifest.name} {contract.hash}</option>
              )}
              </Select>
            </FormControl>
            <FormControl style={formControlStyle} isRequired>
              <FormLabel style={formLabelStyle}>Function</FormLabel>
              <Select style={inputStyle} placeholder="Select" onChange={selectFunction}>
              { abi?.hasOwnProperty('methods') && abi.methods.map((method) =>
                <option key={method.name} value="{method.name}">{method.name}</option> 
              )}
              </Select>
            </FormControl>
            <ContractParameter parameterType={ContractParameterType.String} formLabelText="from" formControlStyle={formControlStyle} formLabelStyle={formLabelStyle} inputStyle={inputStyle} changeFunc={(e) => setRecipientAddress(e.target.value)} />
            <ContractParameter parameterType={ContractParameterType.String} formLabelText="to" formControlStyle={formControlStyle} formLabelStyle={formLabelStyle} inputStyle={inputStyle} changeFunc={(e) => setRecipientAddress(e.target.value)} />
            <ContractParameter parameterType={ContractParameterType.String} formLabelText="amount" formControlStyle={formControlStyle} formLabelStyle={formLabelStyle} inputStyle={inputStyle} changeFunc={(e) => setRecipientAddress(e.target.value)} />
            <ContractParameter parameterType={ContractParameterType.String} formLabelText="data" formControlStyle={formControlStyle} formLabelStyle={formLabelStyle} inputStyle={inputStyle} changeFunc={(e) => setRecipientAddress(e.target.value)} />
            <Button type="submit" w="100%" maxWidth="35rem" bg="#0094ff" textColor="white" fontSize="2rem" h="4rem"
                    mb="2rem"
                    _hover={{backgroundColor: '#0081dc'}}>
                Invoke 
            </Button>
            <Spacer/>
            </>)}
        </Flex>
    )
}
