import * as React from "react";
import {ContractParameterType} from "../types/ContractParameterTypes";
import {FormControl, FormLabel, Input} from "@chakra-ui/react";

export default function ContractParameter(props: any ) {

    return (
            <FormControl style={props.formControlStyle}>
                <FormLabel style={props.formLabelStyle}>{props.formLabelText}</FormLabel>
                <Input
                    style={props.inputStyle}
                    onChange={(e) => props.changeFunc(e.target.value)}/>
            </FormControl>
    );
}
