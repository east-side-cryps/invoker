import * as React from "react";
import {ContractParameterType} from "../types/ContractParameterTypes";
import {FormControl, FormLabel, Input, Link} from "@chakra-ui/react";

export default function ContractParameter(props: any ) {

    if (!(props.parameterType === "Array") && !(props.parameterType === "Map")) {
    return (
            <FormControl style={props.formControlStyle}>
                <FormLabel style={props.formLabelStyle}>{props.formLabelText} ({props.parameterType})</FormLabel>
                <Input
                    data-param-name={props.formLabelText}
                    data-param-type={props.parameterType}
                    style={props.inputStyle}
                    onChange={props.changeFunc}/>
            </FormControl>
    )}
    else
    {
        return (
            <FormControl style={props.formControlStyle}>
                <FormLabel style={props.formLabelStyle}>{props.formLabelText}</FormLabel>
                <Link style={props.formControlStyle} href="#">Click to enter {props.parameterType} data</Link>
            </FormControl>
        )
    }
}
