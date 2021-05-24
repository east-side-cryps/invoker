import React, {useEffect, useState} from "react";
import {useHistory} from "react-router-dom";
import {Contract} from "../types/Contract";
import {Manifest} from "../types/Manifest";
import {ABI} from "../types/ABI";
import {Parameter} from "../types/Parameter";
import axios from 'axios';
import {wallet} from "@cityofzion/neon-js";
import {
    Flex,
    Textarea,
    ModalBody,
    ModalCloseButton,
    ModalHeader,
    ModalOverlay,
    ModalContent,
    Spacer,
    Modal,
    Spinner,
    Text,
    FormControl,
    Select,
    Switch,
    FormLabel, Button, useToast
} from "@chakra-ui/react";
import {useWalletConnect} from "../context/WalletConnectContext";
import {
    DEFAULT_NEO_NETWORK_MAGIC,
    DEFAULT_NEO_RPC_ADDRESS,
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
    color: "#004e87", fontSize: "1.1rem", margin: 0
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

    const [abi, setAbi] = useState<ABI | undefined>()
    const [contractParams, setContractParams] = useState<Parameter[] | undefined>()
    const contracts = useStateSync([])
    const [loading, setLoading] = useState<string | null>('Checking WalletConnect Session')
    const [invokeParams, setInvokeParams] = useState({})
    const [methodName, setMethodName] = useState('')
    const [contractHash, setContractHash] = useState('')
    const [applicationLog, setApplicationLog] = useState<any>()
    const [testMode, setTestMode] = useState(false)

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
              for (let i = 2; i <= totalPages; i++) {
                axios.get<ContractsResponse>(`https://dora.coz.io/api/v1/neo3/testnet/contracts/${i}`)
                .then((response) => {
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

        if (testMode) {
            const result = await invoke()
            setApplicationLog(result)
        } else {
            const txId = await invoke()
            if (!txId) return
            if (txId.length !== 66) {
                console.log("Got unexpected response: " + txId )
                return
            }
            toast({
                title: `Relayed ${txId.slice(0,50)} ${txId.slice(50)}`,
                status: "success",
                duration: 12000,
                isClosable: true
            })
            setLoading('Waiting on transaction to persist...')
            const applog = await n3Helper.getApplogFromTxId(txId)
            if (!applog) {
                setApplicationLog(JSON.stringify({'error': 'Application log not found'}, null, 1))
            } else {
                setApplicationLog(JSON.stringify(applog, null, 1))
            }
            setLoading(null)
        }
    }

    const selectAbi = (e) => {
        setContractParams([])
        setMethodName('')
        setContractHash(e.target.value)
        axios.get<ContractResponse>('https://dora.coz.io/api/v1/neo3/testnet/contract/' + e.target.value)
        .then((response) => {
            //console.log("ABI: " + JSON.stringify(response.data.manifest.abi))
            setAbi(response.data.manifest.abi)
        })
    }

    const selectFunction = (e) => {
        const methods = abi?.methods;
        methods?.forEach(method => {
            if (method.name === e.target.value) {
                setContractParams(method.parameters)
                setMethodName(method.name)
            }
        })
    }

    const setParameterValue = (e) => {
        const invokeParamName = e.target.attributes['data-param-name'].value
        setInvokeParams({...invokeParams, [invokeParamName]: e.target.value})
    }

    const invoke = async () => {
        if (!walletConnectCtx) return null
        const [senderAddress] = walletConnectCtx.accounts[0].split("@")
        let paramArray = [] as any


        if (testMode) {
            if (contractParams) {
                for (let i=0; i < contractParams?.length; i++) {
                    const paramType = contractParams[i].type
                    const paramName = contractParams[i].name
                    const paramValue = invokeParams[paramName]
    
                    if (paramType === "Hash160") {
                        if (paramValue === "@me") {
                            paramArray.push({type: paramType, value: wallet.getScriptHashFromAddress(senderAddress)})
                        } else if (/^N[A-Za-z0-9]{34}$/.test(paramValue)) {
                            paramArray.push({type: paramType, value: wallet.getScriptHashFromAddress(paramValue)})
                        } else {
                            paramArray.push({type: paramType, value: paramValue})
                        }
                    } else if (paramType === "Boolean") {
                        if (paramValue === "false" || paramValue === "False" ||
                        paramValue === "" || paramValue === "0") {
                            paramArray.push({type: paramType, value: false})
                        } else {
                            paramArray.push({type: paramType, value: true})
                        }
                    } else {
                        paramArray.push({type: paramType, value: paramValue})
                    }
                }
            }
            const resp = await n3Helper.testInvoke(contractHash, methodName, paramArray)
            return resp
        } else {
            if (contractParams) {
                for (let i=0; i < contractParams?.length; i++) {
                    const paramType = contractParams[i].type
                    const paramName = contractParams[i].name
                    const paramValue = invokeParams[paramName]
    
                    if (paramType === "Hash160") {
                        if (paramValue === "@me") {
                            paramArray.push({type: "Address", value: senderAddress})
                        } else if (/^N[A-Za-z0-9]{34}$/.test(paramValue)) {
                            paramArray.push({type: "Address", value: paramValue})
                        } else {
                            paramArray.push({type: "ScriptHash", value: paramValue})
                        }
                    } else {
                        paramArray.push({type: paramType, value: paramValue})
                    }
                }
            }
            const resp = await walletConnectCtx.rpcRequest({
                method: 'invokefunction',
                params: [contractHash, methodName, paramArray],
            })

            if (resp.result.error && resp.result.error.message) {
                toast({
                    title: resp.result.error.message,
                    status: "error",
                    duration: 12000,
                    isClosable: true,
                })
                return null
            }
            console.log("Invoke response:" + resp.result)
            return resp.result as string
        }
    }

    const handleSwitch = () => {
        setTestMode(!testMode)
    }

    const handleClose = () => {
        setApplicationLog(null)
    }

    return (
        <Flex as="form" onSubmit={handleSubmit} direction="column" align="center" flex="1" w="100%" px="0.5rem">
            <Modal isOpen={loading != null || applicationLog != null} onClose={handleClose} size="xl">
                <ModalOverlay/>
                <ModalContent>
                    <ModalHeader>{loading ? loading : "Transaction Log"}</ModalHeader>
                    <ModalCloseButton/>
                    <ModalBody>
                        <Flex direction="column" align="center">
                        {applicationLog ? <Textarea rows={20} height="auto" value={applicationLog} isReadOnly={true} size="lg" /> : (<>
                            <Spacer/><SpinnerWithMessage xl={true} message="Loading" /><Spacer/>
                        </>)}
                        </Flex>
                    </ModalBody>
                </ModalContent>
            </Modal>
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
              { abi?.hasOwnProperty('methods') && abi.methods.map((method, index) =>
                <option key={`${index}-${method.name}`} value={method.name}>{method.name}</option> 
              )}
              </Select>
            </FormControl>
            { contractParams?.map((param, index) => 
            <ContractParameter key={index} parameterType={param.type} formLabelText={param.name}
                formControlStyle={formControlStyle} formLabelStyle={formLabelStyle} 
                inputStyle={inputStyle} changeFunc={setParameterValue} />
            )}
             <Button type="submit" w="100%" maxWidth="35rem" bg="#0094ff" textColor="white" fontSize="2rem" h="4rem"
                    mb="2rem"
                    _hover={{backgroundColor: '#0081dc'}}>
                {loading && <Spinner color="#0094FF" size='md' thickness='0.1rem' />}
                Invoke
            </Button>
            <Switch id="testinvoke" name="testinvoke" defaultChecked={false} size="lg" onChange={handleSwitch} />
                Test mode
            <Spacer/>
        </Flex>
    )
}
